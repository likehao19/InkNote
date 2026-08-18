import {
  EditorView,
  Decoration,
  ViewPlugin,
  keymap,
  drawSelection,
  dropCursor,
  lineNumbers,
  type ViewUpdate,
  type DecorationSet,
} from "@codemirror/view";
import {
  EditorState,
  Compartment,
  StateEffect,
  StateField,
  type Extension,
  type Range,
} from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { tags as t } from "@lezer/highlight";
import type { SyntaxNodeRef } from "@lezer/common";
import { CodeBlockWidget, HrWidget } from "./editor/widgets/codeBlock";
import { BlockMathWidget, InlineMathWidget, scanMath } from "./editor/widgets/math";
import {
  TableWidget,
  insertTableAtCursor,
  parseTable,
  tableAtomicRanges,
  tableBackspace,
  tableDeleteKey,
  tableEditingHandlers,
  tableSelectionSnap,
} from "./editor/widgets/table";
import { ImageWidget, parseImage } from "./editor/widgets/image";
import { MermaidWidget } from "./editor/widgets/mermaid";
import { FrontMatterWidget } from "./editor/widgets/frontmatter";
import { tableTab, tableShiftTab } from "./editor/commands/table";
import { bracketExtensions } from "./editor/commands/brackets";
import { editorActionKeymap, runEditorAction, type EditorAction } from "./editor/commands/format";
import { parseFrontMatter } from "./lib/frontmatter";
import { dirOf, relativePath, resolveAssetPath } from "./lib/paths";
import * as api from "./lib/tauri";

export type EditorMode = "preview" | "source";

const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, class: "cm-md-h1" },
  { tag: t.heading2, class: "cm-md-h2" },
  { tag: t.heading3, class: "cm-md-h3" },
  { tag: t.heading4, class: "cm-md-h4" },
  { tag: t.heading5, class: "cm-md-h5" },
  { tag: t.heading6, class: "cm-md-h6" },
  { tag: t.strong, fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, class: "cm-md-link" },
  { tag: t.url, class: "cm-md-link" },
  { tag: t.monospace, class: "cm-md-code" },
  { tag: t.processingInstruction, color: "var(--fg-faint)" },
  { tag: t.comment, color: "var(--syntax-comment)" },
  { tag: t.keyword, color: "var(--syntax-keyword)" },
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.typeName, color: "var(--syntax-type)" },
  { tag: t.meta, color: "var(--syntax-meta)" },
  { tag: t.operator, color: "var(--syntax-operator)" },
  { tag: t.bool, color: "var(--syntax-keyword)" },
]);

const HEADINGS = new Set([
  "ATXHeading1", "ATXHeading2", "ATXHeading3",
  "ATXHeading4", "ATXHeading5", "ATXHeading6",
]);

function hideMarkers(
  node: SyntaxNodeRef,
  name: string,
  decos: Range<Decoration>[],
  overlaps: (from: number, to: number) => boolean,
) {
  for (const c of node.node.getChildren(name)) {
    if (!overlaps(c.from, c.to)) {
      decos.push(Decoration.replace({}).range(c.from, c.to));
    }
  }
}

function fencedCodeInfo(node: SyntaxNodeRef, doc: EditorState["doc"]): string {
  const info = node.node.getChild("CodeInfo");
  if (!info) return "";
  return doc.sliceString(info.from, info.to);
}

function fencedCodeText(node: SyntaxNodeRef, doc: EditorState["doc"]): string {
  const text = node.node.getChild("CodeText");
  if (!text) return "";
  return doc.sliceString(text.from, text.to);
}

function isInCode(tree: ReturnType<typeof syntaxTree>, from: number, to: number): boolean {
  let inside = false;
  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.name === "FencedCode" || node.name === "InlineCode") {
        inside = true;
        return false;
      }
    },
  });
  return inside;
}

function buildDecorations(state: EditorState, filePath: string | null): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;
  const doc = state.doc;
  const tree = syntaxTree(state);

  const overlaps = (from: number, to: number) => from <= selTo && selFrom <= to;

  const lineDeco = (
    from: number,
    to: number,
    cls: string,
    attributes?: Record<string, string>,
  ) => {
    const s = doc.lineAt(from).number;
    const e = doc.lineAt(to).number;
    for (let i = s; i <= e; i++) {
      decos.push(
        Decoration.line({ class: cls, attributes }).range(doc.line(i).from),
      );
    }
  };

  const listDepth = (node: SyntaxNodeRef): number => {
    let depth = 0;
    for (let p = node.node.parent; p; p = p.parent) {
      if (p.name === "BulletList" || p.name === "OrderedList") depth++;
    }
    return depth;
  };

  tree.iterate({
    enter(node) {
      const n = node.name;
      const from = node.from;
      const to = node.to;

      if (HEADINGS.has(n)) {
        for (const c of node.node.getChildren("HeaderMark")) {
          if (!overlaps(c.from, c.to)) {
            let end = c.to;
            if (end < to && doc.sliceString(end, end + 1) === " ") end++;
            decos.push(Decoration.replace({}).range(c.from, end));
          }
        }
        return;
      }

      if (n === "Blockquote") {
        hideMarkers(node, "QuoteMark", decos, overlaps);
        lineDeco(from, to, "md-blockquote");
        return;
      }

      if (n === "StrongEmphasis" || n === "Emphasis") {
        hideMarkers(node, "EmphasisMark", decos, overlaps);
        return;
      }

      if (n === "Strikethrough") {
        hideMarkers(node, "StrikethroughMark", decos, overlaps);
        return;
      }

      if (n === "InlineCode") {
        hideMarkers(node, "CodeMark", decos, overlaps);
        return;
      }

      if (n === "ListMark" || n === "TaskMarker") {
        decos.push(Decoration.replace({}).range(from, to));
        return;
      }

      if (n === "Task") {
        lineDeco(from, to, "md-task-item");
        return;
      }

      if (n === "ListItem") {
        const depth = listDepth(node);
        const classes = ["md-list-item"];
        const parent = node.node.parent;
        if (parent?.name === "OrderedList") classes.push("md-ordered-list");
        else if (parent?.name === "BulletList") classes.push("md-bullet-list");
        const attributes =
          depth > 1
            ? {
                style: `padding-left: calc(var(--editor-padding-x) + ${(depth - 1) * 24}px)`,
              }
            : undefined;
        lineDeco(from, to, classes.join(" "), attributes);
        return;
      }

      if (n === "Link") {
        hideMarkers(node, "LinkMark", decos, overlaps);
        hideMarkers(node, "URL", decos, overlaps);
        if (!overlaps(from, to)) {
          decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        }
        return;
      }

      if (n === "Image") {
        const { alt, url } = parseImage(node, doc);
        const resolved = resolveAssetPath(filePath, url);
        decos.push(
          Decoration.replace({
            widget: new ImageWidget(url, alt, resolved),
            block: true,
          }).range(from, to),
        );
        return;
      }

      if (n === "Autolink") {
        if (!overlaps(from, to)) {
          decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        }
        return;
      }

      if (n === "HorizontalRule") {
        decos.push(
          Decoration.replace({ widget: new HrWidget(), block: true }).range(from, to),
        );
        return;
      }

      if (n === "Table") {
        const { header, rows, aligns } = parseTable(node, doc);
        decos.push(
          Decoration.replace({
            widget: new TableWidget(from, to, header, rows, aligns),
            block: true,
          }).range(from, to),
        );
        return;
      }

      if (n === "TableDelimiter") {
        decos.push(Decoration.replace({}).range(from, to));
        return;
      }

      if (n === "FencedCode") {
        const lang = fencedCodeInfo(node, doc).trim().toLowerCase();
        const code = fencedCodeText(node, doc);
        if (lang === "mermaid") {
          decos.push(
            Decoration.replace({
              widget: new MermaidWidget(code),
              block: true,
            }).range(from, to),
          );
        } else {
          decos.push(
            Decoration.replace({
              widget: new CodeBlockWidget(code, lang),
              block: true,
            }).range(from, to),
          );
        }
        return;
      }
    },
  });

  // 数学公式（$...$ / $$...$$）
  const inCode = (from: number, to: number) => isInCode(tree, from, to);
  for (const math of scanMath(doc, inCode)) {
    if (math.block || !overlaps(math.from, math.to)) {
      decos.push(
        Decoration.replace({
          widget: math.block
            ? new BlockMathWidget(math.tex)
            : new InlineMathWidget(math.tex),
          block: math.block,
        }).range(math.from, math.to),
      );
    }
  }

  // YAML Front Matter
  const fm = parseFrontMatter(doc.toString());
  if (fm) {
    const summary = Object.entries(fm.data)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    decos.push(
      Decoration.replace({
        widget: new FrontMatterWidget(summary),
        block: true,
      }).range(fm.from, fm.to),
    );
  }

  // 脚注引用 [^label]
  const fnRe = /\[\^([^\]]+)\]/g;
  const text = doc.toString();
  let fnm: RegExpExecArray | null;
  while ((fnm = fnRe.exec(text))) {
    const from = fnm.index;
    const to = from + fnm[0].length;
    if (!inCode(from, to) && !overlaps(from, to) && !(fm && from < fm.to)) {
      decos.push(
        Decoration.mark({ class: "cm-md-footnote" }).range(from, to),
      );
    }
  }

  return Decoration.set(decos, true);
}

const rebuildPreviewEffect = StateEffect.define<void>();

function livePreview(ctx: { filePath: string | null }): Extension {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, ctx.filePath);
    },
    update(deco, tr) {
      if (
        tr.docChanged ||
        tr.selection ||
        tr.effects.some((e) => e.is(rebuildPreviewEffect))
      ) {
        return buildDecorations(tr.state, ctx.filePath);
      }
      return deco.map(tr.changes);
    },
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((view) => {
        const deco = view.state.field(f, false);
        return deco ? tableAtomicRanges(deco) : Decoration.none;
      }),
    ],
  });
}

const previewCompartment = new Compartment();
const typewriterCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const spellCheckCompartment = new Compartment();

function spellCheckExt(enabled: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: enabled ? "true" : "false" });
}

function previewExt(mode: EditorMode, ctx: { filePath: string | null }): Extension {
  return mode === "preview" ? [livePreview(ctx), tableSelectionSnap()] : [];
}

function typewriterExt(enabled: boolean): Extension {
  if (!enabled) return [];
  return ViewPlugin.fromClass(
    class {
      update(u: ViewUpdate) {
        if (u.selectionSet || u.docChanged) {
          const head = u.state.selection.main.head;
          u.view.dispatch({
            effects: EditorView.scrollIntoView(head, { y: "center" }),
          });
        }
      }
    },
  );
}

async function insertImage(
  view: EditorView,
  filePath: string | null,
  bytes: Uint8Array,
  ext = "png",
) {
  const dir = filePath ? dirOf(filePath) : ".";
  const name = `image-${Date.now()}.${ext}`;
  const absPath = `${dir}/${name}`.replace(/\\/g, "/");
  try {
    await api.writeBinary(absPath, Array.from(bytes));
  } catch (e) {
    console.error("Failed to save pasted image:", e);
    return;
  }
  const rel = filePath ? relativePath(dir, absPath) : name;
  const insert = `![](${rel})`;
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const atLineStart = pos === line.from;
  const lineEmpty = line.text.trim().length === 0;
  const block = atLineStart && lineEmpty ? `${insert}\n` : `\n${insert}\n`;
  const endPos = pos + block.length;
  view.dispatch({
    changes: { from: pos, insert: block },
    selection: { anchor: endPos },
    scrollIntoView: true,
  });
}

function shouldHandleImagePaste(event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items?.length) return false;

  let imageItem: DataTransferItem | null = null;
  for (const item of items) {
    if (item.type.startsWith("image/")) imageItem = item;
  }
  if (!imageItem) return false;

  const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
  const html = event.clipboardData?.getData("text/html")?.trim() ?? "";
  // 剪贴板同时含文本时优先走普通粘贴（截图通常只有图片）
  if (text || html) return false;
  return true;
}

function mediaHandlers(ctx: { filePath: string | null }): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      if (!shouldHandleImagePaste(event)) return false;
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return true;
          void file.arrayBuffer().then((buf) => {
            const ext = file.type.split("/")[1] || "png";
            void insertImage(view, ctx.filePath, new Uint8Array(buf), ext);
          });
          return true;
        }
      }
      return false;
    },
    drop(event, view) {
      const files = event.dataTransfer?.files;
      if (!files?.length) return false;
      const file = files[0];
      if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) {
        return false;
      }
      event.preventDefault();
      void file.arrayBuffer().then((buf) => {
        const ext = file.name.split(".").pop() || "png";
        void insertImage(view, ctx.filePath, new Uint8Array(buf), ext);
      });
      return true;
    },
    mousedown(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const line = view.state.doc.lineAt(pos);
      const m = /^(\s*[-*+]\s+)\[([ xX])\](\s)/.exec(line.text);
      if (!m) return false;
      const bracketPos = line.from + m[1].length;
      if (pos < bracketPos || pos > bracketPos + 3) return false;
      const checked = m[2].toLowerCase() === "x";
      const newMark = checked ? " " : "x";
      view.dispatch({
        changes: { from: bracketPos + 1, to: bracketPos + 2, insert: newMark },
      });
      event.preventDefault();
      return true;
    },
  });
}

export type { EditorAction };

export interface EditorHandle {
  view: EditorView;
  setMode: (m: EditorMode) => void;
  setFilePath: (path: string | null) => void;
  setTypewriter: (on: boolean) => void;
  setLineNumbers: (on: boolean) => void;
  setWordWrap: (on: boolean) => void;
  setTabSize: (n: number) => void;
  setSpellCheck: (on: boolean) => void;
  scrollToLine: (line: number) => void;
  runAction: (action: EditorAction) => boolean;
  insertTable: (rows: number, cols: number) => boolean;
  destroy: () => void;
}

export interface EditorOptions {
  mode: EditorMode;
  filePath: string | null;
  typewriter: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  spellCheck: boolean;
  onChange: (doc: string) => void;
  onModeChange: (m: EditorMode) => void;
  onCursorLine?: (line: number) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  opts: EditorOptions,
): EditorHandle {
  let mode = opts.mode;
  let typewriter = opts.typewriter;
  const assetContext = { filePath: opts.filePath };

  function toggleMode() {
    mode = mode === "preview" ? "source" : "preview";
    view.dispatch({
      effects: previewCompartment.reconfigure(previewExt(mode, assetContext)),
    });
    opts.onModeChange(mode);
  }

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      lineNumbersCompartment.of(opts.lineNumbers ? lineNumbers() : []),
      wrapCompartment.of(opts.wordWrap ? EditorView.lineWrapping : []),
      tabSizeCompartment.of(EditorState.tabSize.of(opts.tabSize)),
      spellCheckCompartment.of(spellCheckExt(opts.spellCheck)),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(markdownHighlight),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...markdownKeymap,
        ...searchKeymap,
        ...editorActionKeymap(),
        indentWithTab,
        { key: "Tab", run: tableTab },
        { key: "Shift-Tab", run: tableShiftTab },
      ]),
      keymap.of([
        { key: "Backspace", run: tableBackspace },
        { key: "Delete", run: tableDeleteKey },
      ]),
      search({ top: true }),
      highlightSelectionMatches(),
      bracketExtensions(),
      keymap.of([{ key: "Mod-/", run: () => { toggleMode(); return true; } }]),
      previewCompartment.of(previewExt(mode, assetContext)),
      typewriterCompartment.of(typewriterExt(typewriter)),
      mediaHandlers(assetContext),
      tableEditingHandlers(),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) opts.onChange(u.state.doc.toString());
        if (u.selectionSet || u.viewportChanged) {
          const line = u.state.doc.lineAt(u.state.selection.main.head).number;
          opts.onCursorLine?.(line);
        }
      }),
    ],
  });

  const view = new EditorView({ state, parent });

  return {
    view,
    setMode: (m: EditorMode) => {
      if (m !== mode) toggleMode();
    },
    setFilePath: (path: string | null) => {
      if (assetContext.filePath === path) return;
      assetContext.filePath = path;
      if (mode === "preview") {
        view.dispatch({ effects: rebuildPreviewEffect.of() });
      }
    },
    setTypewriter: (on: boolean) => {
      if (on === typewriter) return;
      typewriter = on;
      view.dispatch({
        effects: typewriterCompartment.reconfigure(typewriterExt(typewriter)),
      });
    },
    setLineNumbers: (on: boolean) => {
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(on ? lineNumbers() : []),
      });
    },
    setWordWrap: (on: boolean) => {
      view.dispatch({
        effects: wrapCompartment.reconfigure(on ? EditorView.lineWrapping : []),
      });
    },
    setTabSize: (n: number) => {
      view.dispatch({
        effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(n)),
      });
    },
    setSpellCheck: (on: boolean) => {
      view.dispatch({
        effects: spellCheckCompartment.reconfigure(spellCheckExt(on)),
      });
    },
    scrollToLine: (line: number) => {
      const n = Math.max(1, Math.min(line, view.state.doc.lines));
      const pos = view.state.doc.line(n).from;
      view.dispatch({
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
        selection: { anchor: pos },
      });
      view.focus();
    },
    runAction: (action: EditorAction) => runEditorAction(view, action),
    insertTable: (rows: number, cols: number) => insertTableAtCursor(view, rows, cols),
    destroy: () => view.destroy(),
  };
}
