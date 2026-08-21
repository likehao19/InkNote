import { WidgetType, EditorView } from "@codemirror/view";
import { bindBlockBoundaryCursor, currentBlockRange, stampBlockRange } from "./blockRange";
import {
  attachBlockSelection,
  attachSourceEditing,
  caretTextOffset,
  clickedOnBlockPadding,
  makePlainTextEditable,
  setCaretOffset,
} from "./editableSource";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import diff from "highlight.js/lib/languages/diff";
import ini from "highlight.js/lib/languages/ini";
import { getLocale, t } from "../../lib/i18n";

for (const [lang, mod] of [
  ["bash", bash],
  ["sh", bash],
  ["shell", bash],
  ["c", cpp],
  ["cpp", cpp],
  ["csharp", csharp],
  ["cs", csharp],
  ["css", css],
  ["diff", diff],
  ["go", go],
  ["html", xml],
  ["ini", ini],
  ["toml", ini],
  ["xml", xml],
  ["java", java],
  ["js", javascript],
  ["javascript", javascript],
  ["json", json],
  ["md", markdown],
  ["markdown", markdown],
  ["php", php],
  ["py", python],
  ["python", python],
  ["rb", ruby],
  ["ruby", ruby],
  ["rs", rust],
  ["rust", rust],
  ["sql", sql],
  ["ts", typescript],
  ["typescript", typescript],
  ["yaml", yaml],
  ["yml", yaml],
] as const) {
  if (!hljs.getLanguage(lang)) hljs.registerLanguage(lang, mod);
}

/** 语言下拉里的候选项（都是能真正高亮的） */
const LANGUAGE_OPTIONS = [
  "", "bash", "c", "cpp", "csharp", "css", "diff", "go", "html", "ini", "java",
  "javascript", "json", "markdown", "mermaid", "php", "python", "ruby", "rust",
  "sql", "toml", "typescript", "xml", "yaml",
];

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: "C++",
  csharp: "C#",
  javascript: "JavaScript",
  typescript: "TypeScript",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  xml: "XML",
  yaml: "YAML",
  toml: "TOML",
  ini: "INI",
  php: "PHP",
  go: "Go",
};

function normalizeLang(info: string): string {
  const raw = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (raw === "tsx") return "typescript";
  if (raw === "jsx") return "javascript";
  return raw;
}

function langLabel(lang: string): string {
  return LANGUAGE_LABELS[lang] ?? (lang || t(getLocale(), "editor.code.plainText"));
}

/** 把代码写进元素并上色；keepCaret 用于输入过程中保持光标不跳 */
function paintCode(codeEl: HTMLElement, code: string, lang: string, keepCaret: boolean) {
  const normalized = normalizeLang(lang);
  const offset = keepCaret ? caretTextOffset(codeEl) : null;

  if (normalized && hljs.getLanguage(normalized)) {
    codeEl.innerHTML = hljs.highlight(code, { language: normalized }).value;
    codeEl.className = `hljs language-${normalized}`;
  } else {
    codeEl.textContent = code;
    codeEl.className = "hljs";
  }

  // 结尾是换行时补一个占位文本节点，否则最后一行在 contenteditable 里点不进去
  if (code.endsWith("\n")) codeEl.appendChild(document.createTextNode(""));

  if (offset != null) setCaretOffset(codeEl, offset);
}

function paintGutter(gutter: HTMLElement, code: string) {
  const lines = code.split("\n").length;
  let text = "";
  for (let i = 1; i <= lines; i++) text += (i > 1 ? "\n" : "") + i;
  if (gutter.textContent !== text) gutter.textContent = text;
}

export class CodeBlockWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly code: string,
    readonly lang: string,
    readonly indented = false,
  ) {
    super();
  }

  /** 只比较内容与长度：位置变化不应触发重新高亮 */
  eq(other: CodeBlockWidget) {
    return (
      other.to - other.from === this.to - this.from &&
      other.code === this.code &&
      other.lang === this.lang &&
      other.indented === this.indented
    );
  }

  private serialize(code: string, lang: string): string {
    if (this.indented && !lang.trim()) {
      return code.replace(/\n+$/, "").split("\n").map((line) => `    ${line}`).join("\n");
    }
    return `\`\`\`${lang.trim()}\n${code.replace(/\n+$/, "")}\n\`\`\``;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-codeblock-widget";
    stampBlockRange(wrap, this.from, this.to);

    // 外层只负责纵向留白，视觉盒子放内层：根元素带 margin 会让
    // CodeMirror 的高度图算不准（rect 不含外边距）
    const box = document.createElement("div");
    box.className = "md-codeblock-box";
    wrap.appendChild(box);

    const gutter = document.createElement("div");
    gutter.className = "md-codeblock-gutter";
    gutter.contentEditable = "false";
    paintGutter(gutter, this.code);

    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    makePlainTextEditable(codeEl);
    paintCode(codeEl, this.code, this.lang, false);
    pre.appendChild(codeEl);

    box.appendChild(gutter);
    box.appendChild(pre);

    // 右上角只放复制；语言选择单独贴在代码块左上边缘。
    const header = document.createElement("div");
    header.className = "md-codeblock-header";
    header.contentEditable = "false";

    const languageControl = document.createElement("div");
    languageControl.className = "md-codeblock-language-control";
    languageControl.contentEditable = "false";

    const select = document.createElement("select");
    select.className = "md-codeblock-lang";
    const current = normalizeLang(this.lang);
    const options = LANGUAGE_OPTIONS.includes(current)
      ? LANGUAGE_OPTIONS
      : [...LANGUAGE_OPTIONS, current];
    for (const value of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = langLabel(value);
      if (value === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.value = current;
    select.addEventListener("mousedown", (e) => e.stopPropagation());
    select.addEventListener("change", () => {
      const view = EditorView.findFromDOM(wrap);
      const range = view && currentBlockRange(view, wrap);
      if (!view || !range) return;
      const code = codeEl.textContent ?? "";
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: this.serialize(code, select.value) },
        userEvent: "input.codeblock",
      });
      view.focus();
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "md-codeblock-copy";
    copyBtn.textContent = t(getLocale(), "editor.code.copy");
    copyBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(codeEl.textContent ?? this.code);
      copyBtn.textContent = t(getLocale(), "editor.code.copied");
      window.setTimeout(() => {
        copyBtn.textContent = t(getLocale(), "editor.code.copy");
      }, 1200);
    });

    header.appendChild(copyBtn);
    languageControl.appendChild(select);
    box.appendChild(header);
    box.appendChild(languageControl);
    bindBlockBoundaryCursor(wrap, box);

    attachSourceEditing(wrap, {
      source: () => codeEl,
      toMarkdown: (text) => this.serialize(text, select.value),
      onInput: (text, el) => {
        paintCode(el, text, select.value, true);
        paintGutter(gutter, text);
      },
      indentOnTab: true,
      exitOnTrailingBlankLine: true,
    });

    // 点在代码区以外的盒内留白也进入编辑；外层留白不抢点击
    wrap.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".md-codeblock-header")) return;
      if (!box.contains(target)) return;
      if (codeEl.contains(target) || target === codeEl) return;
      event.preventDefault();
      codeEl.focus();
      setCaretOffset(codeEl, (codeEl.textContent ?? "").length);
    });

    return wrap;
  }

  updateDOM(dom: HTMLElement) {
    const codeEl = dom.querySelector<HTMLElement>("code");
    const select = dom.querySelector<HTMLSelectElement>(".md-codeblock-lang");
    const gutter = dom.querySelector<HTMLElement>(".md-codeblock-gutter");
    if (!codeEl || !select || !gutter) return false;

    stampBlockRange(dom, this.from, this.to);

    const lang = normalizeLang(this.lang);
    if (select.value !== lang) {
      if (!Array.from(select.options).some((o) => o.value === lang)) {
        const opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = langLabel(lang);
        select.appendChild(opt);
      }
      select.value = lang;
    }

    // 正在输入的元素不能重写，否则光标会被打掉
    if (document.activeElement !== codeEl && (codeEl.textContent ?? "") !== this.code) {
      paintCode(codeEl, this.code, this.lang, false);
      paintGutter(gutter, this.code);
    }
    return true;
  }

  /** 组件内交互自理；点在外层留白上的鼠标事件交还编辑器定位光标 */
  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-codeblock-widget");
  }
}

export class HrWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: HrWidget) {
    return other.to - other.from === this.to - this.from;
  }

  toDOM() {
    const hr = document.createElement("div");
    hr.className = "md-hr-widget";
    hr.setAttribute("role", "separator");
    stampBlockRange(hr, this.from, this.to);
    attachBlockSelection(hr);
    return hr;
  }

  updateDOM(dom: HTMLElement) {
    stampBlockRange(dom, this.from, this.to);
    return true;
  }

  ignoreEvent() {
    return true;
  }
}
