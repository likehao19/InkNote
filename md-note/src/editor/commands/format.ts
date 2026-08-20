import { EditorView } from "@codemirror/view";
import { undo, redo, selectAll } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { requestTableInsert } from "../tableInsertBridge";
import { insertTableAtCursor, mutateTableInView } from "../widgets/table";
import { editorPickLink, editorPickImage, editorShowError, editorShowMessage } from "../../lib/editorBridge";
import { markdownToBodyHtml } from "../../render/export";
import { getLocale, t } from "../../lib/i18n";

export type EditorAction =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "find"
  | "findReplace"
  | "bold"
  | "italic"
  | "strikethrough"
  | "inlineCode"
  | "highlight"
  | "underline"
  | "superscript"
  | "subscript"
  | "copyHtml"
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

const HEADING_RE = /^#{1,6}\s+/;
const BULLET_RE = /^[-*+]\s+/;
const ORDERED_RE = /^\d+[.)]\s+/;
const TASK_RE = /^(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/;
const QUOTE_RE = /^>\s?/;

function focusView(view: EditorView) {
  view.focus();
}

function wrapInline(view: EditorView, before: string, after: string): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);

  // 选区自身带标记：**词** → 词
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
      userEvent: "input.format",
    });
    focusView(view);
    return true;
  }

  // 标记在选区外侧：选中 **词** 中间的「词」时也应能取消
  const outerFrom = from - before.length;
  const outerTo = to + after.length;
  if (
    outerFrom >= 0 &&
    outerTo <= state.doc.length &&
    state.sliceDoc(outerFrom, from) === before &&
    state.sliceDoc(to, outerTo) === after
  ) {
    view.dispatch({
      changes: [
        { from: outerFrom, to: from, insert: "" },
        { from: to, to: outerTo, insert: "" },
      ],
      selection: { anchor: outerFrom, head: outerFrom + selected.length },
      userEvent: "input.format",
    });
    focusView(view);
    return true;
  }

  const insert = `${before}${selected}${after}`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
    userEvent: "input.format",
  });
  focusView(view);
  return true;
}

/** 拆出缩进与正文：缩进必须保留，否则嵌套列表会被拉平到顶层 */
function stripBlockPrefix(text: string): { indent: string; content: string } {
  const indent = /^\s*/.exec(text)?.[0] ?? "";
  let rest = text.slice(indent.length);
  rest = rest.replace(QUOTE_RE, "");
  rest = rest.replace(HEADING_RE, "");
  rest = rest.replace(TASK_RE, "");
  rest = rest.replace(BULLET_RE, "");
  rest = rest.replace(ORDERED_RE, "");
  return { indent, content: rest };
}

/** 选区覆盖的所有行（块级命令应作用于整个选区，而不是首行） */
function selectedLines(state: EditorView["state"]) {
  const { from, to } = state.selection.main;
  const first = state.doc.lineAt(from).number;
  const last = state.doc.lineAt(to).number;
  const lines = [];
  for (let n = first; n <= last; n++) lines.push(state.doc.line(n));
  return lines;
}

function toggleLinePrefix(
  view: EditorView,
  prefix: string,
  active: RegExp,
  numbered = false,
): boolean {
  const { state } = view;
  const lines = selectedLines(state).filter((l) => l.text.trim().length > 0);
  if (!lines.length) {
    const line = state.doc.lineAt(state.selection.main.from);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${prefix}` },
      selection: { anchor: line.from + prefix.length },
      userEvent: "input.format",
    });
    focusView(view);
    return true;
  }

  const allActive = lines.every((l) => active.test(l.text.trimStart()));
  const changes: Array<{ from: number; to: number; insert: string }> = [];

  lines.forEach((line, i) => {
    const { indent, content } = stripBlockPrefix(line.text);
    const marker = numbered ? `${i + 1}. ` : prefix;
    const next = allActive ? `${indent}${content}` : `${indent}${marker}${content}`;
    if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next });
  });

  if (changes.length) view.dispatch({ changes, userEvent: "input.format" });
  focusView(view);
  return true;
}

function setHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const lines = selectedLines(state).filter((l) => l.text.trim().length > 0);
  if (!lines.length) return true;

  const marker = level > 0 ? `${"#".repeat(level)} ` : "";
  const allSame =
    level > 0 && lines.every((l) => new RegExp(`^#{${level}}\\s+`).test(l.text.trimStart()));

  const changes: Array<{ from: number; to: number; insert: string }> = [];
  for (const line of lines) {
    const { indent, content } = stripBlockPrefix(line.text);
    const next = allSame || level === 0 ? `${indent}${content}` : `${indent}${marker}${content}`;
    if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next });
  }

  if (changes.length) view.dispatch({ changes, userEvent: "input.format" });
  focusView(view);
  return true;
}

function openReplacePanel(view: EditorView): boolean {
  openSearchPanel(view);
  requestAnimationFrame(() => {
    const panel = view.dom.querySelector(".cm-panel.cm-search");
    const replaceBtn = panel?.querySelector("button[name=replace]") as HTMLButtonElement | null;
    if (replaceBtn) replaceBtn.click();
    const replaceInput = panel?.querySelector("input[name=replace]") as HTMLInputElement | null;
    if (replaceInput) replaceInput.focus();
  });
  focusView(view);
  return true;
}

async function insertLink(view: EditorView): Promise<boolean> {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const result = await editorPickLink(selected);
  if (!result || !result.url.trim()) return false;
  const text = result.text.trim() || result.url.trim();
  const url = result.url.trim();
  const insert = `[${text}](${url})`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
  focusView(view);
  return true;
}

async function insertImage(view: EditorView): Promise<boolean> {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const result = await editorPickImage(selected);
  if (!result || !result.path.trim()) return false;
  const insert = `![${result.alt}](${result.path.trim()})`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
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

async function copyHtmlFromView(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const md = from === to ? view.state.doc.toString() : view.state.sliceDoc(from, to);
  try {
    const html = await markdownToBodyHtml(md);
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([md], { type: "text/plain" }),
      }),
    ]);
    editorShowMessage(t(getLocale(), "toast.copiedHtml"));
  } catch (e) {
    editorShowError(e);
  }
  focusView(view);
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
    case "findReplace":
      return openReplacePanel(view);
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
    case "underline":
      return wrapInline(view, "<u>", "</u>");
    case "superscript":
      return wrapInline(view, "<sup>", "</sup>");
    case "subscript":
      return wrapInline(view, "<sub>", "</sub>");
    case "copyHtml":
      void copyHtmlFromView(view);
      return true;
    case "link":
      void insertLink(view);
      return true;
    case "image":
      void insertImage(view);
      return true;
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
      return toggleLinePrefix(view, "1. ", ORDERED_RE, true);
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
      void mutateTableInView(view, "row-below");
      return true;
    case "tableRowAbove":
      void mutateTableInView(view, "row-above");
      return true;
    case "tableRowDelete":
      void mutateTableInView(view, "row-delete");
      return true;
    case "tableColLeft":
      void mutateTableInView(view, "col-left");
      return true;
    case "tableColRight":
      void mutateTableInView(view, "col-right");
      return true;
    case "tableColDelete":
      void mutateTableInView(view, "col-delete");
      return true;
    case "tableAlignLeft":
      void mutateTableInView(view, "align-left");
      return true;
    case "tableAlignCenter":
      void mutateTableInView(view, "align-center");
      return true;
    case "tableAlignRight":
      void mutateTableInView(view, "align-right");
      return true;
    case "tableDelete":
      void mutateTableInView(view, "delete");
      return true;
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
    { key: "Mod-h", run: (v) => runEditorAction(v, "findReplace") },
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
