import { EditorView, keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { markdownLanguage } from "@codemirror/lang-markdown";

/** 选中文本后按这些字符直接包裹（Typora 习惯），光标态不做自动配对 */
const WRAP_CHARS: Record<string, string> = {
  "*": "*",
  _: "_",
  "`": "`",
  "~": "~",
  "=": "=",
  '"': '"',
  "'": "'",
};

/**
 * 仅在存在选区时包裹，光标态交给默认输入。
 *
 * 之所以不对光标态做配对：`don't` 会变成 `don't'`、`2 * 3` 会变成 `2 ** 3`、
 * `snake_case` 会变成 `snake_case_`，这些在 Markdown 里都是高频输入。
 */
function wrapSelection(): Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (from === to) return false;
    const close = WRAP_CHARS[text];
    if (!close) return false;

    view.dispatch({
      changes: [
        { from, insert: text },
        { from: to, insert: close },
      ],
      selection: { anchor: from + text.length, head: to + text.length },
      userEvent: "input.type",
    });
    return true;
  });
}

/**
 * 括号自动配对。
 *
 * 用官方 `closeBrackets()`：它自带「输入闭合符则跳过」「退格删掉整对」
 * 「选中包裹」等行为。引号从配对集合里移除，避免英文缩写被打断。
 */
export function bracketExtensions(): Extension {
  return [
    markdownLanguage.data.of({
      closeBrackets: { brackets: ["(", "[", "{"] },
    }),
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
    wrapSelection(),
  ];
}
