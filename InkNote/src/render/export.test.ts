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
    const pixyll = await markdownToHtml("# Pixyll", "light", "zh", null, false, "pixyll");
    const sepia = await markdownToHtml("# Sepia", "light", "zh", null, false, "sepia");

    expect(light).toContain("--doc-panel:#f3f5f7");
    expect(light).toContain("--doc-accent:#42b883");
    expect(dark).toContain("--doc-panel:#242727");
    expect(dark).toContain("--doc-accent:#9aacaa");
    expect(pixyll).toContain("Merriweather");
    expect(pixyll).toContain("border-bottom:2px solid #333333");
    expect(sepia).toContain("--doc-bg:#faf6ee");
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

  it("preserves backgrounds, print layout, and theme-specific table/code styles for PDF export across all themes", async () => {
    const sample = "# Title\n\n| A | B |\n| --- | --- |\n| `foo` | bar |\n\n```bash\ndocker run -d --name app --memory 128m\n```";
    const newsprint = await markdownToHtml(sample, "light", "zh", null, false, "newsprint");
    const night = await markdownToHtml(sample, "light", "zh", null, false, "night");
    const whitey = await markdownToHtml(sample, "light", "zh", null, false, "whitey");

    // Print color fidelity and wrapping for PDF export
    expect(newsprint).toContain("print-color-adjust: exact !important");
    expect(newsprint).toContain("@page { background: #f3f2ee; }");
    expect(newsprint).toContain("white-space: pre-wrap");
    expect(newsprint).toContain("thead th { background:#dadada;");
    expect(newsprint).toContain("pre { background:#eae7df; border:1px solid #d5d0c4;");

    // Enhanced bash CLI flag & builtin highlighting in exported HTML/PDF
    expect(newsprint).toContain("hljs-built_in");
    expect(newsprint).toContain("hljs-attr");
    expect(newsprint).toContain("hljs-number");

    // Night theme always exports dark surface + readable dark syntax colors
    expect(night).toContain("@page { background: #363b40; }");
    expect(night).toContain("--hljs-keyword:#f28b82");
    expect(night).toContain("--doc-mark-fg:#1a1a1a");

    // Whitey code blocks and inline code have visible surfaces
    expect(whitey).toContain("pre { background:#fafafa; border:1px solid #dddddd;");
  });

  it("highlights extended languages like dockerfile and nginx in exported HTML", async () => {
    const md = "```dockerfile\nFROM node:22-alpine\nRUN npm ci\n```\n\n```nginx\nserver { listen 80; }\n```";
    const html = await markdownToBodyHtml(md);
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("language-dockerfile");
    expect(html).toContain("language-nginx");
  });
});
