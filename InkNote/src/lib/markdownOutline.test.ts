import { describe, expect, it } from "vitest";
import { buildMarkdownToc, extractMarkdownOutline } from "./markdownOutline";

describe("markdown outline", () => {
  it("ignores front matter and fenced code while reading headings", () => {
    const content = "---\ntitle: Demo\n---\n# 标题\n```md\n## 不是标题\n```\n小节\n---";
    expect(extractMarkdownOutline(content)).toEqual([
      { level: 1, text: "标题", line: 4, anchor: "标题" },
      { level: 2, text: "小节", line: 8, anchor: "小节" },
    ]);
  });

  it("builds nested links and disambiguates duplicate anchors", () => {
    const content = "# Hello World\n## Details\n# Hello World";
    expect(buildMarkdownToc(content)).toBe(
      "- [Hello World](#hello-world)\n  - [Details](#details)\n- [Hello World](#hello-world-1)",
    );
  });
});
