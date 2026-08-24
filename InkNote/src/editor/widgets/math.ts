import { WidgetType } from "@codemirror/view";
import katex from "katex";
import { bindBlockBoundaryCursor, bindBlockClickEdit, stampBlockRange } from "./blockRange";
import {
  attachSourceEditing,
  beginSourceEditing,
  clickedOnBlockPadding,
  makePlainTextEditable,
} from "./editableSource";
import { getLocale, t } from "../../lib/i18n";

function renderMath(target: HTMLElement, tex: string, display: boolean) {
  try {
    // render() 会在部分 WebView / 测试文档被判定为 quirks mode 时直接拒绝渲染；
    // renderToString() 不依赖宿主文档模式，生成的结果与标准页面一致。
    target.innerHTML = katex.renderToString(tex, {
      throwOnError: false,
      displayMode: display,
    });
  } catch {
    target.textContent = display ? `$$${tex}$$` : `$${tex}$`;
  }
  if (!tex.trim()) {
    target.textContent = display ? t(getLocale(), "editor.math.empty") : "$$";
    target.classList.add("md-math-empty");
  } else {
    target.classList.remove("md-math-empty");
  }
}

/** 行内公式：与其它行内标记一致，点击露出源码 */
export class InlineMathWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly tex: string,
  ) {
    super();
  }

  eq(other: InlineMathWidget) {
    return other.to - other.from === this.to - this.from && other.tex === this.tex;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "md-math-inline";
    bindBlockClickEdit(span, this.from, this.to);
    renderMath(span, this.tex, false);
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

/** 块级公式：点击即在组件内改 LaTeX，右侧实时预览 */
export class BlockMathWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly tex: string,
  ) {
    super();
  }

  eq(other: BlockMathWidget) {
    return other.to - other.from === this.to - this.from && other.tex === this.tex;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-math-block";
    stampBlockRange(wrap, this.from, this.to);

    const source = document.createElement("div");
    source.className = "md-block-source";
    makePlainTextEditable(source);
    source.textContent = this.tex;

    const render = document.createElement("div");
    render.className = "md-math-render";
    renderMath(render, this.tex, true);

    wrap.appendChild(source);
    wrap.appendChild(render);
    bindBlockBoundaryCursor(wrap, render);

    attachSourceEditing(wrap, {
      source: () => source,
      toMarkdown: (text) => `$$\n${text.trim()}\n$$`,
      onInput: (text) => renderMath(render, text, true),
      indentOnTab: false,
    });

    wrap.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      if (target === wrap) return; // 外层留白交给编辑器定位光标
      if (source.contains(target) || target === source) return;
      event.preventDefault();
      beginSourceEditing(wrap, source);
    });

    return wrap;
  }

  updateDOM(dom: HTMLElement) {
    const source = dom.querySelector<HTMLElement>(".md-block-source");
    const render = dom.querySelector<HTMLElement>(".md-math-render");
    if (!source || !render) return false;

    stampBlockRange(dom, this.from, this.to);
    if (document.activeElement !== source) {
      if ((source.textContent ?? "") !== this.tex) source.textContent = this.tex;
      renderMath(render, this.tex, true);
    }
    return true;
  }

  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-math-block");
  }
}

interface MathDoc {
  length: number;
  sliceString: (f: number, t: number) => string;
  lineAt: (p: number) => { from: number; to: number; number: number };
  lines: number;
}

export interface MathRange {
  from: number;
  to: number;
  tex: string;
  block: boolean;
}

/** 区间是否恰好占满整行（决定能否用块级装饰） */
function occupiesWholeLines(doc: MathDoc, from: number, to: number): boolean {
  return doc.lineAt(from).from === from && doc.lineAt(to).to === to;
}

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

/**
 * 扫描文档中的数学公式区间（排除代码块内）。
 *
 * 行内公式采用与 Typora 一致的保守规则，避免把金额当成公式：
 * 开定界符后必须紧跟非空白、闭定界符前必须是非空白、闭定界符后不能紧跟数字。
 * 例如 `价格 $5 到 $10 元` 不会被识别为公式。
 */
export function scanMath(
  doc: MathDoc,
  inCode: (from: number, to: number) => boolean,
  sourceText?: string,
): MathRange[] {
  const text = sourceText ?? doc.sliceString(0, doc.length);
  const results: MathRange[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\") {
      i += 2; // 跳过转义（含 \$）
      continue;
    }
    if (ch !== "$") {
      i++;
      continue;
    }

    // 块级 $$...$$
    if (text[i + 1] === "$") {
      const close = text.indexOf("$$", i + 2);
      if (close < 0) {
        i += 2;
        continue;
      }
      const from = i;
      const to = close + 2;
      if (!inCode(from, to)) {
        results.push({
          from,
          to,
          tex: text.slice(from + 2, close).trim(),
          block: occupiesWholeLines(doc, from, to),
        });
      }
      i = to;
      continue;
    }

    // 行内 $...$
    if (isSpace(text[i + 1]) || text[i + 1] === undefined) {
      i++;
      continue;
    }

    let j = i + 1;
    let close = -1;
    while (j < text.length) {
      const c = text[j];
      if (c === "\n") break;
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "$") {
        if (!isSpace(text[j - 1]) && !isDigit(text[j + 1])) close = j;
        break;
      }
      j++;
    }

    if (close < 0) {
      i++;
      continue;
    }

    const from = i;
    const to = close + 1;
    if (!inCode(from, to)) {
      results.push({ from, to, tex: text.slice(from + 1, close).trim(), block: false });
    }
    i = to;
  }

  return results;
}
