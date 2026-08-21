import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./htmlPaste";

describe("htmlToMarkdown", () => {
  it("保留常用行内格式和安全的代码围栏", () => {
    const html = '<p><strong>粗体</strong> <del>删除</del> <code>a`b</code></p>' +
      '<pre><code class="language-ts">const fence = ```;</code></pre>';

    expect(htmlToMarkdown(html)).toBe(
      "**粗体** ~~删除~~ ``a`b``\n\n````ts\nconst fence = ```;\n````",
    );
  });

  it("转换表格并转义单元格中的管道符", () => {
    const html = "<table><thead><tr><th>名称</th><th>值</th></tr></thead>" +
      "<tbody><tr><td>A|B</td><td>1</td></tr></tbody></table>";

    expect(htmlToMarkdown(html)).toBe(
      "| 名称 | 值 |\n| --- | --- |\n| A\\|B | 1 |",
    );
  });

  it("保留有序列表起始值、嵌套层级和任务状态", () => {
    const html = '<ol start="3"><li>第三项<ul><li><input type="checkbox" checked>完成</li></ul></li></ol>';

    expect(htmlToMarkdown(html)).toBe("3. 第三项\n  - [x] 完成");
  });
});
