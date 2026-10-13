import { describe, expect, it } from "vitest";
import { buildMarkdownToc, extractMarkdownOutline } from "./markdownOutline";

describe("markdown outline", () => {
  it.each(["\n", "\r\n", "\r"])("preserves heading text, lines and anchors with %j line endings", (newline) => {
    const content = [
      "---", "title: Demo", "# Not a heading", "---", "# 标题", "",
      "```md", "## Not a heading", "```", "## 小节 ##", "",
      "下划线标题", "---", "# 标题",
    ].join(newline);
    expect(extractMarkdownOutline(content)).toEqual([
      { level: 1, text: "标题", line: 5, anchor: "标题" },
      { level: 2, text: "小节", line: 10, anchor: "小节" },
      { level: 2, text: "下划线标题", line: 12, anchor: "下划线标题" },
      { level: 1, text: "标题", line: 14, anchor: "标题-1" },
    ]);
    expect(buildMarkdownToc(content)).toBe(
      "- [标题](#标题)\n  - [小节](#小节)\n  - [下划线标题](#下划线标题)\n- [标题](#标题-1)",
    );
  });

  it("supports mixed line endings and a heading at the end of the file", () => {
    expect(extractMarkdownOutline("# One\r\n\r## Two\n### Three")).toEqual([
      { level: 1, text: "One", line: 1, anchor: "one" },
      { level: 2, text: "Two", line: 3, anchor: "two" },
      { level: 3, text: "Three", line: 4, anchor: "three" },
    ]);
  });

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
