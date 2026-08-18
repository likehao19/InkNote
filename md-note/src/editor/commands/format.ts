import { EditorView } from "@codemirror/view";
import { undo, redo, selectAll } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { requestTableInsert } from "../tableInsertBridge";
import { insertTableAtCursor, mutateTableInView } from "../widgets/table";

export type EditorAction =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "find"
  | "bold"
  | "italic"
  | "strikethrough"
  | "inlineCode"
  | "highlight"
  | "link"
  | "image"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "hr"
  | "codeBlock"
  | "table"
  | "tableRowBelow"
  | "tableRowAbove"
  | "tableRowDelete"
  | "tableColLeft"
  | "tableColRight"
  | "tableColDelete"
  | "tableAlignLeft"
  | "tableAlignCenter"
  | "tableAlignRight"
  | "tableDelete"
  | "mathBlock"
  | "mermaid";

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^[-*+]\s+/;
const ORDERED_RE = /^\d+\.\s+/;
const TASK_RE = /^[-*+]\s+\[[ xX]\]\s+/;
const QUOTE_RE = /^>\s?/;

function focusView(view: EditorView) {
  view.focus();
}

function wrapInline(view: EditorView, before: string, after: string): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    });
  } else {
    const insert = `${before}${selected}${after}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
  }
  focusView(view);
  return true;
}

function stripBlockPrefix(text: string): string {
  return text
    .replace(HEADING_RE, "$2")
    .replace(TASK_RE, "")
    .replace(BULLET_RE, "")
    .replace(ORDERED_RE, "")
    .replace(QUOTE_RE, "")
    .trimStart();
}

function setLineText(view: EditorView, lineFrom: number, lineTo: number, text: string) {
  view.dispatch({
    changes: { from: lineFrom, to: lineTo, insert: text },
  });
}

function toggleLinePrefix(view: EditorView, prefix: string, active: RegExp): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.from);
  const text = line.text;
  const content = stripBlockPrefix(text);
  const newText = active.test(text) ? content : `${prefix}${content}`;
  setLineText(view, line.from, line.to, newText);
  focusView(view);
  return true;
}

function setHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.from);
  const text = line.text;
  const m = text.match(HEADING_RE);
  const content = stripBlockPrefix(text);

  let newText: string;
  if (level === 0) {
    newText = content;
  } else if (m && m[1].length === level) {
    newText = content;
  } else {
    newText = `${"#".repeat(level)} ${content}`;
  }

  setLineText(view, line.from, line.to, newText);
  focusView(view);
  return true;
}

function insertBlock(view: EditorView, text: string, cursorOffset?: number): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const prefix = line.text.length > 0 ? "\n\n" : "";
  const insert = `${prefix}${text}`;
  const at = line.to;
  view.dispatch({
    changes: { from: at, insert },
    selection: {
      anchor: at + insert.length + (cursorOffset ?? 0),
      head: at + insert.length + (cursorOffset ?? 0),
    },
  });
  focusView(view);
  return true;
}

function clipboardAction(view: EditorView, action: "cut" | "copy" | "paste"): boolean {
  const dom = view.contentDOM;
  dom.focus();
  if (action === "paste") {
    if (document.execCommand("paste")) return true;
    void (async () => {
      try {
        const text = await navigator.clipboard.readText();
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        focusView(view);
      } catch {
        /* clipboard permission denied */
      }
    })();
    return true;
  }
  if (document.execCommand(action)) return true;
  const { from, to } = view.state.selection.main;
  if (from === to) return false;
  const text = view.state.sliceDoc(from, to);
  void navigator.clipboard.writeText(text).catch(() => {});
  if (action === "cut") {
    view.dispatch({ changes: { from, to, insert: "" } });
  }
  focusView(view);
  return true;
}

export function runEditorAction(view: EditorView, action: EditorAction): boolean {
  switch (action) {
    case "undo":
      return undo(view);
    case "redo":
      return redo(view);
    case "cut":
      return clipboardAction(view, "cut");
    case "copy":
      return clipboardAction(view, "copy");
    case "paste":
      return clipboardAction(view, "paste");
    case "selectAll":
      return selectAll(view);
    case "find":
      openSearchPanel(view);
      focusView(view);
      return true;
    case "bold":
      return wrapInline(view, "**", "**");
    case "italic":
      return wrapInline(view, "*", "*");
    case "strikethrough":
      return wrapInline(view, "~~", "~~");
    case "inlineCode":
      return wrapInline(view, "`", "`");
    case "highlight":
      return wrapInline(view, "==", "==");
    case "link": {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const insert = `[${selected}](url)`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
      });
      focusView(view);
      return true;
    }
    case "image": {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const insert = `![${selected}](path)`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + selected.length + 4, head: from + selected.length + 8 },
      });
      focusView(view);
      return true;
    }
    case "paragraph":
      return setHeading(view, 0);
    case "heading1":
      return setHeading(view, 1);
    case "heading2":
      return setHeading(view, 2);
    case "heading3":
      return setHeading(view, 3);
    case "heading4":
      return setHeading(view, 4);
    case "heading5":
      return setHeading(view, 5);
    case "heading6":
      return setHeading(view, 6);
    case "bulletList":
      return toggleLinePrefix(view, "- ", BULLET_RE);
    case "orderedList":
      return toggleLinePrefix(view, "1. ", ORDERED_RE);
    case "taskList":
      return toggleLinePrefix(view, "- [ ] ", TASK_RE);
    case "blockquote":
      return toggleLinePrefix(view, "> ", QUOTE_RE);
    case "hr":
      return insertBlock(view, "---");
    case "codeBlock":
      return insertBlock(view, "```\n\n```", -4);
    case "table":
      return requestTableInsert() || insertTableAtCursor(view, 2, 2);
    case "tableRowBelow":
      return mutateTableInView(view, "row-below");
    case "tableRowAbove":
      return mutateTableInView(view, "row-above");
    case "tableRowDelete":
      return mutateTableInView(view, "row-delete");
    case "tableColLeft":
      return mutateTableInView(view, "col-left");
    case "tableColRight":
      return mutateTableInView(view, "col-right");
    case "tableColDelete":
      return mutateTableInView(view, "col-delete");
    case "tableAlignLeft":
      return mutateTableInView(view, "align-left");
    case "tableAlignCenter":
      return mutateTableInView(view, "align-center");
    case "tableAlignRight":
      return mutateTableInView(view, "align-right");
    case "tableDelete":
      return mutateTableInView(view, "delete");
    case "mathBlock":
      return insertBlock(view, "$$\n\n$$", -3);
    case "mermaid":
      return insertBlock(view, "```mermaid\ngraph TD\n  A --> B\n```", -4);
    default:
      return false;
  }
}

export function editorActionKeymap(): Array<{ key: string; run: (view: EditorView) => boolean }> {
  return [
    { key: "Mod-z", run: (v) => runEditorAction(v, "undo") },
    { key: "Mod-y", run: (v) => runEditorAction(v, "redo") },
    { key: "Mod-Shift-z", run: (v) => runEditorAction(v, "redo") },
    { key: "Mod-b", run: (v) => runEditorAction(v, "bold") },
    { key: "Mod-i", run: (v) => runEditorAction(v, "italic") },
    { key: "Mod-k", run: (v) => runEditorAction(v, "link") },
    { key: "Mod-f", run: (v) => runEditorAction(v, "find") },
    { key: "Mod-1", run: (v) => runEditorAction(v, "heading1") },
    { key: "Mod-2", run: (v) => runEditorAction(v, "heading2") },
    { key: "Mod-3", run: (v) => runEditorAction(v, "heading3") },
    { key: "Mod-4", run: (v) => runEditorAction(v, "heading4") },
    { key: "Mod-5", run: (v) => runEditorAction(v, "heading5") },
    { key: "Mod-6", run: (v) => runEditorAction(v, "heading6") },
    { key: "Mod-0", run: (v) => runEditorAction(v, "paragraph") },
    { key: "Mod-Shift-8", run: (v) => runEditorAction(v, "bulletList") },
    { key: "Mod-Shift-7", run: (v) => runEditorAction(v, "orderedList") },
    { key: "Mod-Shift-x", run: (v) => runEditorAction(v, "taskList") },
    { key: "Mod-Shift-q", run: (v) => runEditorAction(v, "blockquote") },
    { key: "Mod-Shift-k", run: (v) => runEditorAction(v, "codeBlock") },
    { key: "Mod-Shift-m", run: (v) => runEditorAction(v, "mathBlock") },
    { key: "Mod-Shift-i", run: (v) => runEditorAction(v, "image") },
    { key: "Mod-Shift-`", run: (v) => runEditorAction(v, "inlineCode") },
    { key: "Mod-t", run: (v) => runEditorAction(v, "table") },
  ];
}
