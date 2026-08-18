import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import katexCss from "katex/dist/katex.min.css?inline";
import type { ResolvedTheme } from "../lib/theme";

const BASE_CSS = `
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; line-height: 1.75; max-width: 46rem; margin: 2rem auto; padding: 0 1.5rem; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 6px 12px; }
  th { background: #f6f8fa; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #555; }
  pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 0.9em; }
  a { color: #0969da; }
`;

const DARK_CSS = `
  body { background: #1e1e1e; color: #ccc; }
  th { background: #2d2d30; }
  th, td { border-color: #444; }
  blockquote { color: #9d9d9d; border-color: #555; }
  pre { background: #2d2d30; }
  a { color: #4da3ff; }
`;

export async function markdownToHtml(md: string, theme: ResolvedTheme): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(md);

  const themeCss = theme === "dark" ? DARK_CSS : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Export</title>
  <style>${katexCss}</style>
  <style>${BASE_CSS}${themeCss}</style>
</head>
<body>
${String(result)}
</body>
</html>`;
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 1000);
}
