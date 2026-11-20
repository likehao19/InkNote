import { describe, expect, it } from "vitest";
import { markdownToBodyHtml, markdownToHtml } from "./export";

describe("markdownToBodyHtml", () => {
  it("preserves table cell line breaks in exported HTML", async () => {
    const html = await markdownToBodyHtml("| A |\n| --- |\n| one<br>two<br>three |");
    expect(html).toMatch(/<td>one<br>two<br>three<\/td>/);
  });
  it("保留允许的排版标签并移除可执行 HTML", async () => {
    const html = await markdownToBodyHtml(
      '<u onclick="alert(1)">下划线</u> ==高亮== <script>alert(2)</script> [危险](javascript:alert(3))',
    );

    expect(html).toContain("<u>下划线</u>");
    expect(html).toContain("<mark>高亮</mark>");
    expect(html).not.toMatch(/onclick|<script|javascript:/i);
  });

  it("exports the selected Markdown theme in both color modes", async () => {
    const light = await markdownToHtml("# Vue", "light", "zh", null, false, "vue");
    const dark = await markdownToHtml("# Minimal", "dark", "zh", null, false, "minimal");

    expect(light).toContain("--doc-panel:#f3f5f7");
    expect(light).toContain("--doc-accent:#42b883");
    expect(dark).toContain("--doc-panel:#242727");
    expect(dark).toContain("--doc-accent:#9aacaa");
  });

  it("preserves details and safe images and links across the HTML export", async () => {
    const html = await markdownToBodyHtml(
      '<details open ontoggle="bad()">\n<summary>More</summary>\n\n**Body**<br><a href="https://example.com">link</a> <img src="photo.png" width="64" onerror="bad()">\n\n</details>\n\n<iframe src="https://example.com"></iframe>',
    );
    expect(html).toMatch(/<details open>/);
    expect(html).toContain("<summary>More</summary>");
    expect(html).toContain("<strong>Body</strong><br>");
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toMatch(/<img[^>]*src="photo\.png"[^>]*width="64"/);
    expect(html).not.toMatch(/ontoggle|onerror|iframe/i);
  });

  it("uses the document name and includes portable code/task styles", async () => {
    const html = await markdownToHtml("- [x] done\n\n```ts\nconst n = 1\n```", "light", "en", "D:\\notes\\guide.md");

    expect(html).toContain("<title>guide.md</title>");
    expect(html).toContain(".hljs-keyword");
    expect(html).toContain(".task-list-item");
  });

  it("embeds a pending image even before the document has a disk path", async () => {
    const dataUrl = "data:image/png;base64,cGVuZGluZw==";
    const html = await markdownToHtml(
      "![pending](.inknote-assets/pending.png)",
      "light",
      "zh",
      null,
      true,
      "github",
      new Map([[".inknote-assets/pending.png", dataUrl]]),
    );

    expect(html).toContain(`src="${dataUrl}"`);
  });
});
