import { WidgetType } from "@codemirror/view";
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

for (const [lang, mod] of [
  ["bash", bash],
  ["sh", bash],
  ["css", css],
  ["html", xml],
  ["xml", xml],
  ["java", java],
  ["js", javascript],
  ["javascript", javascript],
  ["json", json],
  ["md", markdown],
  ["markdown", markdown],
  ["py", python],
  ["python", python],
  ["rs", rust],
  ["rust", rust],
  ["sql", sql],
  ["ts", typescript],
  ["typescript", typescript],
] as const) {
  hljs.registerLanguage(lang, mod);
}

function normalizeLang(info: string): string {
  const raw = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (raw === "tsx") return "typescript";
  if (raw === "jsx") return "javascript";
  return raw;
}

export class CodeBlockWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly lang: string,
  ) {
    super();
  }

  eq(other: CodeBlockWidget) {
    return other.code === this.code && other.lang === this.lang;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-codeblock-widget";

    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    const lang = normalizeLang(this.lang);

    if (lang && hljs.getLanguage(lang)) {
      codeEl.innerHTML = hljs.highlight(this.code, { language: lang }).value;
      codeEl.className = `hljs language-${lang}`;
    } else {
      codeEl.textContent = this.code;
      codeEl.className = "hljs";
    }

    if (lang) {
      const badge = document.createElement("span");
      badge.className = "md-codeblock-lang";
      badge.textContent = lang;
      wrap.appendChild(badge);
    }

    pre.appendChild(codeEl);
    wrap.appendChild(pre);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

export class HrWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const hr = document.createElement("div");
    hr.className = "md-hr-widget";
    hr.setAttribute("role", "separator");
    return hr;
  }

  ignoreEvent() {
    return false;
  }
}
