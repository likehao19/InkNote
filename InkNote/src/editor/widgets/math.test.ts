import { Text } from "@codemirror/state";
import { describe, expect, it, vi } from "vitest";
import { scanMath } from "./math";

describe("scanMath", () => {
  it("复用调用方已经物化的文档文本", () => {
    const doc = Text.of(["行内 $x+1$", "$$", "y=2", "$$"]);
    const source = doc.toString();
    const sliceString = vi.spyOn(doc, "sliceString");

    const ranges = scanMath(doc, () => false, source);

    expect(ranges.map(({ tex, block }) => ({ tex, block }))).toEqual([
      { tex: "x+1", block: false },
      { tex: "y=2", block: true },
    ]);
    expect(sliceString).not.toHaveBeenCalled();
  });

  it("排除代码区间并避免把金额识别为公式", () => {
    const doc = Text.of(["价格 $5 到 $10 元", "`$code$`", "有效 $z$"]);
    const codeFrom = doc.toString().indexOf("$code$");
    const ranges = scanMath(doc, (from, to) => from <= codeFrom && to >= codeFrom);

    expect(ranges.map((range) => range.tex)).toEqual(["z"]);
  });
});
