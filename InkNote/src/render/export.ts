import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import katexCss from "katex/dist/katex.min.css?inline";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ResolvedTheme } from "../lib/theme";
import type { Locale } from "../lib/i18n";
import type { MarkdownTheme } from "../lib/markdownTheme";
import { configuredMermaid } from "../lib/mermaid";
import { resolveAssetPath } from "../lib/paths";

const BASE_CSS = `
  :root { --doc-bg: #fcfcfd; --doc-fg: #24272d; --doc-muted: #68707c; --doc-border: #dfe3e8; --doc-accent: #3268c8; --doc-panel: #f3f5f8; --doc-mark: #fff0a8; --doc-radius: 9px; --doc-heading: -apple-system, "Segoe UI", system-ui, sans-serif; }
  body { background: var(--doc-bg); color: var(--doc-fg); font-family: -apple-system, "Segoe UI", system-ui, sans-serif; line-height: 1.75; max-width: 46rem; margin: 2rem auto; padding: 0 1.5rem; }
  h1, h2, h3, h4, h5, h6 { color: var(--doc-fg); font-family: var(--doc-heading); letter-spacing: -0.015em; }
  img { max-width: 100%; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid var(--doc-border); padding: 8px 12px; }
  th { background: var(--doc-panel); }
  blockquote { border-left: 3px solid var(--doc-accent); margin-left: 0; padding: .55em 1em; color: var(--doc-muted); background: color-mix(in srgb, var(--doc-accent) 5%, transparent); }
  pre { background: var(--doc-panel); border: 1px solid var(--doc-border); padding: 1em; border-radius: var(--doc-radius); overflow-x: auto; }
  pre code.hljs { background: transparent; padding: 0; }
  .hljs-comment, .hljs-quote { color: #6e7781; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag { color: #cf222e; }
  .hljs-string, .hljs-addition { color: #0a3069; }
  .hljs-number, .hljs-literal { color: #0550ae; }
  .hljs-title, .hljs-type, .hljs-built_in { color: #8250df; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 0.9em; }
  :not(pre) > code { background: var(--doc-panel); border-radius: 4px; padding: .14em .4em; }
  a { color: var(--doc-accent); }
  mark { background: var(--doc-mark); padding: 0 2px; }
  .mermaid { text-align: center; margin: 1em 0; }
  .footnotes { font-size: 0.9em; color: var(--doc-muted); border-top: 1px solid var(--doc-border); margin-top: 2em; padding-top: 1em; }
  .contains-task-list { list-style: none; padding-left: 1.4em; }
  .task-list-item > input[type="checkbox"] { margin: 0 .45em 0 -1.35em; accent-color: var(--doc-accent); }
`;

const DARK_CSS = `
  :root { --doc-bg: #181a1f; --doc-fg: #e6e9ee; --doc-muted: #aab1bc; --doc-border: #3b414a; --doc-accent: #78a9ff; --doc-panel: #22252b; --doc-mark: #554b20; }
`;

function markdownThemeCss(theme: MarkdownTheme, colorTheme: ResolvedTheme): string {
  if (theme === "vue") {
    return colorTheme === "dark"
      ? `:root { --doc-border:#3a3a3a; --doc-accent:#42d392; --doc-panel:#242424; --doc-radius:4px; }`
      : `:root { --doc-border:#e2e2e3; --doc-accent:#42b883; --doc-panel:#f3f5f7; --doc-radius:4px; }`;
  }
  if (theme === "minimal") {
    return colorTheme === "dark"
      ? `:root { --doc-border:#343939; --doc-accent:#9aacaa; --doc-panel:#242727; --doc-radius:2px; }`
      : `:root { --doc-border:#e0e5e4; --doc-accent:#647a76; --doc-panel:#f5f7f7; --doc-radius:2px; }`;
  }
  return "";
}

/** 允许常用排版标签，同时剔除 script、事件属性和危险 URL。 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark", "u", "kbd"],
};

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
  const mermaid = await configuredMermaid(wanted);

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
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, SANITIZE_SCHEMA)
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
  markdownTheme: MarkdownTheme = "github",
): Promise<string> {
  let bodyHtml = await markdownToBodyHtml(md, theme);
  if (embedImages && mdPath) {
    bodyHtml = await embedImagesInHtml(bodyHtml, mdPath);
  }
  const exportKatexCss = embedImages ? await embedFontUrlsInCss(katexCss) : katexCss;
  const themeCss = `${theme === "dark" ? DARK_CSS : ""}${markdownThemeCss(markdownTheme, theme)}`;
  const lang = locale === "zh" ? "zh-CN" : "en";
  const title = (mdPath?.split(/[\\/]/).pop() || "InkNote")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: https: http:; style-src 'unsafe-inline'; font-src data:;" />
  <title>${title}</title>
  <style>${exportKatexCss}</style>
  <style>${BASE_CSS}${themeCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
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

let embeddedKatexCss: Promise<string> | null = null;

function embedFontUrlsInCss(css: string): Promise<string> {
  if (embeddedKatexCss) return embeddedKatexCss;
  embeddedKatexCss = (async () => {
    const woff2Only = css.replace(
      /src:\s*(url\([^)]*\.woff2\)\s*format\(["']woff2["']\))[^;}]*;/g,
      "src:$1;",
    );
    const urls = [...new Set(
      [...woff2Only.matchAll(/url\((?:["'])?([^"')]+)(?:["'])?\)/g)].map((match) => match[1]),
    )];
    const dataUrls = await Promise.all(urls.map((url) => urlToDataUrl(url)));
    return urls.reduce(
      (result, url, index) => dataUrls[index] ? result.split(url).join(dataUrls[index]!) : result,
      woff2Only,
    );
  })();
  return embeddedKatexCss;
}

async function fileToDataUrl(absPath: string): Promise<string | null> {
  return urlToDataUrl(convertFileSrc(absPath));
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
