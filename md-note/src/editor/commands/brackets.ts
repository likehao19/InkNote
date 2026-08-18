import { EditorView } from "@codemirror/view";

const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
  "*": "*",
  _: "_",
};

/** 输入开括号/引号时自动补全闭符号 */
export function bracketExtensions(): import("@codemirror/state").Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    const close = PAIRS[text];
    if (!close) return false;

    // 行首的 * / _ 常用于列表，不自动成对补全
    if ((text === "*" || text === "_") && from === to) {
      const line = view.state.doc.lineAt(from);
      const before = line.text.slice(0, from - line.from);
      if (/^\s*$/.test(before)) return false;
    }

    if (from !== to) {
      // 包裹选区
      view.dispatch({
        changes: [
          { from, insert: text },
          { from: to, insert: close },
        ],
        selection: { anchor: from + 1, head: to + 1 },
      });
      return true;
    }
    view.dispatch({
      changes: { from, to, insert: text + close },
      selection: { anchor: from + 1 },
    });
    return true;
  });
}
