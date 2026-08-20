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
import mermaid from "mermaid";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ResolvedTheme } from "../lib/theme";
import type { Locale } from "../lib/i18n";
import { resolveAssetPath } from "../lib/paths";

const BASE_CSS = `
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; line-height: 1.75; max-width: 46rem; margin: 2rem auto; padding: 0 1.5rem; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 6px 12px; }
  th { background: #f6f8fa; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #555; }
  pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }
  pre code.hljs { background: transparent; padding: 0; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 0.9em; }
  a { color: #0969da; }
  mark { background: #fff8c5; padding: 0 2px; }
  .mermaid { text-align: center; margin: 1em 0; }
  .footnotes { font-size: 0.9em; color: #555; border-top: 1px solid #ddd; margin-top: 2em; padding-top: 1em; }
`;

const DARK_CSS = `
  body { background: #1e1e1e; color: #ccc; }
  th { background: #2d2d30; }
  th, td { border-color: #444; }
  blockquote { color: #9d9d9d; border-color: #555; }
  pre { background: #2d2d30; }
  a { color: #4da3ff; }
  mark { background: #5a5320; color: #e4e4e4; }
  .footnotes { color: #9d9d9d; border-color: #444; }
`;

function rehypeHighlightMarks() {
  const skip = new Set(["code", "pre", "script", "style"]);
  const transform = (node: any) => {
    if (!Array.isArray(node.children) || skip.has(node.tagName)) return;
    const children: any[] = [];
    for (const child of node.children) {
      if (child.type !== "text" || typeof child.value !== "string") {
        transform(child);
        children.push(child);
        continue;
      }
      const re = /==([^=\n]+?)==/g;
      let from = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(child.value))) {
        if (match.index > from) children.push({ type: "text", value: child.value.slice(from, match.index) });
        children.push({
          type: "element",
          tagName: "mark",
          properties: {},
          children: [{ type: "text", value: match[1] }],
        });
        from = match.index + match[0].length;
      }
      if (from === 0) children.push(child);
      else if (from < child.value.length) children.push({ type: "text", value: child.value.slice(from) });
    }
    node.children = children;
  };
  return transform;
}

const HTML_UNESCAPE: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
};

function unescapeHtml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (m) => HTML_UNESCAPE[m] ?? m);
}

let mermaidTheme: string | null = null;
let mermaidId = 0;

/**
 * 导出时把 Mermaid 直接渲染成内联 SVG。
 *
 * 之前是往导出文件里塞一段从 CDN 拉 mermaid 的 <script type="module">：
 * 离线打不开，PDF 打印也依赖网络，而且要求页面允许内联脚本。
 */
async function renderMermaidBlocks(html: string, theme: ResolvedTheme): Promise<string> {
  const re = /<pre><code class="[^"]*language-mermaid[^"]*">([\s\S]*?)<\/code><\/pre>/gi;
  const blocks: Array<{ match: string; code: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    blocks.push({ match: m[0], code: unescapeHtml(m[1]) });
  }
  if (!blocks.length) return html;

  const wanted = theme === "dark" ? "dark" : "neutral";
  if (mermaidTheme !== wanted) {
    mermaid.initialize({ startOnLoad: false, theme: wanted, securityLevel: "strict" });
    mermaidTheme = wanted;
  }

  let out = html;
  for (const block of blocks) {
    try {
      const { svg } = await mermaid.render(`export-mmd-${++mermaidId}`, block.code);
      out = out.replace(block.match, () => `<div class="mermaid">${svg}</div>`);
    } catch {
      /* 渲染失败保留原始代码块 */
    }
  }
  return out;
}

async function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeHighlightMarks)
    .use(rehypeKatex)
    .use(rehypeHighlight)
    .use(rehypeStringify);
}

export async function markdownToBodyHtml(
  md: string,
  theme: ResolvedTheme = "light",
): Promise<string> {
  const processor = await buildProcessor();
  const result = await processor.process(md);
  return renderMermaidBlocks(String(result), theme);
}

export async function markdownToHtml(
  md: string,
  theme: ResolvedTheme,
  locale: Locale = "zh",
  mdPath?: string | null,
  embedImages = false,
): Promise<string> {
  let bodyHtml = await markdownToBodyHtml(md, theme);
  if (embedImages && mdPath) {
    bodyHtml = await embedImagesInHtml(bodyHtml, mdPath);
  }
  const themeCss = theme === "dark" ? DARK_CSS : "";
  const lang = locale === "zh" ? "zh-CN" : "en";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: https: http:; style-src 'unsafe-inline'; font-src data:;" />
  <title>Export</title>
  <style>${katexCss}</style>
  <style>${BASE_CSS}${themeCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function fileToDataUrl(absPath: string): Promise<string | null> {
  try {
    const res = await fetch(convertFileSrc(absPath));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function embedImagesInHtml(html: string, mdPath: string): Promise<string> {
  const re = /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi;
  const parts: Array<{ match: string; src: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    parts.push({ match: m[0], src: m[2] });
  }
  let out = html;
  for (const { match, src } of parts) {
    if (src.startsWith("data:") || /^https?:/i.test(src)) continue;
    const abs = resolveAssetPath(mdPath, src);
    const dataUrl = await fileToDataUrl(abs);
    if (dataUrl) {
      out = out.replace(match, match.replace(src, dataUrl));
    }
  }
  return out;
}

export function printHtml(html: string, onDone?: () => void) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  const win = frame.contentWindow;
  if (!win) return;

  const doPrint = () => {
    win.focus();
    win.print();
    onDone?.();
    setTimeout(() => frame.remove(), 1000);
  };

  setTimeout(doPrint, 1200);
}
