import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { invertedEffects } from "@codemirror/commands";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { LANGUAGE_OPTIONS } from "./widgets/codeBlock";

export const CODE_FENCE = /^(`{3,}|~{3,})([^\s`~]*)\s*$/;
export const setDraftFences = StateEffect.define<readonly number[]>({
  map: (positions, changes) => positions.map((pos) => changes.mapPos(pos)),
});

// 输入中的围栏暂不参与预览解析，避免与后文已有的结束围栏误配对。
export const draftFences = StateField.define<readonly number[]>({
  create: () => [],
  update(value, tr) {
    const restored = tr.effects.find((effect) => effect.is(setDraftFences));
    if (restored) return restored.value;
    if (!tr.docChanged) return value;
    const positions = value.map((pos) => tr.changes.mapPos(pos, -1)).filter((pos) => {
      const line = tr.newDoc.lineAt(pos);
      return line.from === pos && CODE_FENCE.test(line.text);
    });
    if (!tr.startState.readOnly && tr.isUserEvent("input.type") && tr.newSelection.main.empty) {
      const head = tr.newSelection.main.head;
      const line = tr.newDoc.lineAt(head);
      if (head === line.to && CODE_FENCE.test(line.text) && !positions.includes(line.from)) {
        const oldPos = tr.changes.invertedDesc.mapPos(line.from);
        let node = previewSyntaxTree(tr.startState).resolveInner(oldPos, 1);
        let inCode = false;
        for (; node.parent; node = node.parent) {
          if (node.name === "FencedCode" || node.name === "CodeBlock") inCode = true;
        }
        if (!inCode) positions.push(line.from);
      }
    }
    return positions;
  },
});

export function previewSyntaxTree(state: EditorState) {
  const drafts = state.field(draftFences, false) ?? [];
  if (!drafts.length) return ensureSyntaxTree(state, state.doc.length, 100) ?? syntaxTree(state);
  let text = state.doc.toString();
  for (const from of drafts) {
    const line = state.doc.lineAt(from);
    text = text.slice(0, from) + " ".repeat(line.length) + text.slice(line.to);
  }
  return markdownLanguage.parser.parse(text);
}

export function codeLanguageCompletion(context: CompletionContext) {
  if (context.state.readOnly) return null;
  const line = context.state.doc.lineAt(context.pos);
  const match = CODE_FENCE.exec(line.text);
  if (!match || context.pos < line.from + match[1].length) return null;
  const drafts = context.state.field(draftFences, false);
  if (!drafts?.includes(line.from)) return null;
  return {
    from: line.from + match[1].length,
    options: LANGUAGE_OPTIONS.filter(Boolean).map((label) => ({ label, type: "type" })),
    validFor: /^[\w+-]*$/,
  };
}

export function codeFenceExtensions() {
  return [
    draftFences,
    invertedEffects.of((tr) => {
      const before = tr.startState.field(draftFences, false) ?? [];
      const after = tr.state.field(draftFences, false) ?? [];
      return before.length || after.length ? [setDraftFences.of(before)] : [];
    }),
    autocompletion({ override: [codeLanguageCompletion], defaultKeymap: false, interactionDelay: 0 }),
  ];
}
