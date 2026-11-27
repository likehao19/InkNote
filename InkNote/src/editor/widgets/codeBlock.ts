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
import { hljs } from "../../lib/codeHighlight";
import { getLocale, t } from "../../lib/i18n";

/** 语言下拉里的候选项（覆盖常用前后端、脚本与运维配置语言） */
export const LANGUAGE_OPTIONS = [
  "", "bash", "c", "cmake", "cpp", "csharp", "css", "dart", "diff", "dockerfile",
  "dos", "go", "gradle", "graphql", "groovy", "html", "http", "ini", "java",
  "javascript", "json", "kotlin", "latex", "less", "lua", "makefile", "markdown",
  "mermaid", "nginx", "objectivec", "perl", "php", "powershell", "properties",
  "protobuf", "python", "r", "ruby", "rust", "scala", "scss", "sql", "swift",
  "toml", "typescript", "xml", "yaml",
];

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cmake: "CMake",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  dart: "Dart",
  diff: "Diff",
  dockerfile: "Dockerfile",
  dos: "Batch",
  go: "Go",
  gradle: "Gradle",
  graphql: "GraphQL",
  groovy: "Groovy",
  html: "HTML",
  http: "HTTP",
  ini: "INI",
  java: "Java",
  javascript: "JavaScript",
  json: "JSON",
  kotlin: "Kotlin",
  latex: "LaTeX",
  less: "Less",
  lua: "Lua",
  makefile: "Makefile",
  markdown: "Markdown",
  mermaid: "Mermaid",
  nginx: "Nginx",
  objectivec: "Objective-C",
  perl: "Perl",
  php: "PHP",
  powershell: "PowerShell",
  properties: "Properties",
  protobuf: "Protobuf",
  python: "Python",
  r: "R",
  ruby: "Ruby",
  rust: "Rust",
  scala: "Scala",
  scss: "SCSS",
  sql: "SQL",
  swift: "Swift",
  toml: "TOML",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
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

  // 保留末尾空行的可见光标位置，占位符不属于代码内容。
  if (!code || code.endsWith("\n")) {
    const end = document.createElement("br");
    end.setAttribute("data-code-end", "");
    codeEl.appendChild(end);
  }

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
    return `\`\`\`${lang.trim()}\n${code}\n\`\`\``;
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
    const languageLabel = document.createElement("span");
    languageLabel.className = "md-codeblock-language-label";
    languageLabel.textContent = langLabel(current);
    select.addEventListener("mousedown", (e) => e.stopPropagation());
    select.addEventListener("change", () => {
      const view = EditorView.findFromDOM(wrap);
      const range = view && currentBlockRange(view, wrap);
      if (!view || !range) return;
      if (view.state.readOnly) return;
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
    languageControl.appendChild(languageLabel);
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
      codeBlock: true,
    });

    // 点在代码区以外的盒内留白也进入编辑；外层留白不抢点击
    wrap.addEventListener("mousedown", (event) => {
      const view = EditorView.findFromDOM(wrap);
      if (view?.state.readOnly) {
        // 只读预览不进入源码编辑，但必须保留浏览器原生文本框选。
        // 点击按钮以外的代码区时不能 preventDefault，否则无法选择单词或多行。
        if (codeEl.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest(".md-codeblock-header")) return;
        event.preventDefault();
        return;
      }
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
    const languageLabel = dom.querySelector<HTMLElement>(".md-codeblock-language-label");
    if (languageLabel) languageLabel.textContent = langLabel(lang);
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

    const line = document.createElement("span");
    line.className = "md-hr-line";
    line.setAttribute("aria-hidden", "true");
    hr.appendChild(line);

    // 分割线上下的视觉留白跳过已折叠源码空行，落到相邻可见段落。
    bindBlockBoundaryCursor(hr, line);
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
