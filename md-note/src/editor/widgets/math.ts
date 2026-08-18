import { WidgetType } from "@codemirror/view";
import { bindBlockClickEdit } from "./blockRange";
import katex from "katex";

export class InlineMathWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly tex: string,
  ) {
    super();
  }

  eq(other: InlineMathWidget) {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.tex === this.tex
    );
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "md-math-inline";
    bindBlockClickEdit(span, this.from, this.to);
    try {
      katex.render(this.tex, span, { throwOnError: false, displayMode: false });
    } catch {
      span.textContent = `$${this.tex}$`;
    }
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

export class BlockMathWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly tex: string,
  ) {
    super();
  }

  eq(other: BlockMathWidget) {
    return other.from === this.from && other.to === this.to && other.tex === this.tex;
  }

  toDOM() {
    const div = document.createElement("div");
    div.className = "md-math-block";
    bindBlockClickEdit(div, this.from, this.to);
    try {
      katex.render(this.tex, div, { throwOnError: false, displayMode: true });
    } catch {
      div.textContent = `$$${this.tex}$$`;
    }
    return div;
  }

  ignoreEvent() {
    return true;
  }
}

/** 扫描文档中的数学公式区间（排除代码块内） */
export function scanMath(
  doc: { length: number; sliceString: (f: number, t: number) => string; lineAt: (p: number) => { from: number; to: number; number: number }; lines: number },
  inCode: (from: number, to: number) => boolean,
): { from: number; to: number; tex: string; block: boolean }[] {
  const text = doc.sliceString(0, doc.length);
  const results: { from: number; to: number; tex: string; block: boolean }[] = [];

  // 块级 $$...$$
  const blockRe = /\$\$([\s\S]*?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(text))) {
    const from = m.index;
    const to = from + m[0].length;
    if (!inCode(from, to)) {
      results.push({ from, to, tex: m[1].trim(), block: true });
    }
  }

  // 行内 $...$（不含 $$）
  const inlineRe = /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g;
  while ((m = inlineRe.exec(text))) {
    const from = m.index;
    const to = from + m[0].length;
    if (!inCode(from, to) && !results.some((r) => from >= r.from && to <= r.to)) {
      results.push({ from, to, tex: m[1].trim(), block: false });
    }
  }

  return results.sort((a, b) => a.from - b.from);
}
