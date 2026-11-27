import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  HTML_BLOCK_TAGS, HTML_IMAGE_PROTOCOLS, HTML_IMAGE_SIZE, HTML_INLINE_TAGS, HTML_LINK_PROTOCOLS, HTML_STRIP_TAGS,
} from "../lib/htmlPolicy";
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
import { HLJS_ALIASES, HLJS_LANGUAGES } from "../lib/codeHighlight";

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  :root {
    --doc-bg: #fcfcfd; --doc-fg: #24272d; --doc-muted: #68707c; --doc-border: #dfe3e8;
    --doc-accent: #3268c8; --doc-panel: #f3f5f8; --doc-code-bg: var(--doc-panel);
    --doc-inline-code-bg: var(--doc-panel); --doc-inline-code-fg: inherit;
    --doc-mark: #fff0a8; --doc-mark-fg: inherit; --doc-radius: 8px;
    --doc-heading: -apple-system, "Segoe UI", system-ui, sans-serif;
    --hljs-fg: #24292f; --hljs-comment: #6e7781; --hljs-keyword: #cf222e; --hljs-string: #0a3069;
    --hljs-number: #0550ae; --hljs-title: #8250df; --hljs-builtin: #953800; --hljs-operator: #57606a;
  }
  html { background: var(--doc-bg); color: var(--doc-fg); }
  body { background: var(--doc-bg); color: var(--doc-fg); font-family: -apple-system, "Segoe UI", system-ui, sans-serif; line-height: 1.78; max-width: 960px; margin: 2rem auto; padding: 0 2rem; }
  h1, h2, h3, h4, h5, h6 { color: var(--doc-fg); font-family: var(--doc-heading); letter-spacing: -0.015em; line-height: 1.3; }
  hr { border: 0; border-top: 1px solid var(--doc-border); margin: 1.6em 0; }
  img { max-width: 100%; height: auto; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); }
  table { border-collapse: collapse; width: 100%; margin: 1.1em 0; }
  th, td { border: 1px solid var(--doc-border); padding: 8px 12px; text-align: left; vertical-align: top; overflow-wrap: break-word; }
  th[align="center"], td[align="center"] { text-align: center; }
  th[align="right"], td[align="right"] { text-align: right; }
  th { background: var(--doc-panel); font-weight: 600; }
  td code, th code { overflow-wrap: anywhere; }
  blockquote { border-left: 3.5px solid var(--doc-accent); margin: 1em 0; padding: .55em 1em; color: var(--doc-muted); background: color-mix(in srgb, var(--doc-accent) 5%, transparent); }
  blockquote > :first-child { margin-top: 0; }
  blockquote > :last-child { margin-bottom: 0; }
  pre { background: var(--doc-code-bg, var(--doc-panel)); color: var(--hljs-fg); border: 1px solid var(--doc-border); padding: 0.95em 1.15em; border-radius: var(--doc-radius); overflow-x: auto; line-height: 1.6; }
  pre code, pre code.hljs { background: transparent; border: 0; padding: 0; color: inherit; }
  .hljs-comment, .hljs-quote { color: var(--hljs-comment); font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-doctag, .hljs-deletion { color: var(--hljs-keyword); }
  .hljs-string, .hljs-regexp, .hljs-addition { color: var(--hljs-string); }
  .hljs-number, .hljs-literal, .hljs-symbol, .hljs-attr, .hljs-attribute, .hljs-property, .hljs-params { color: var(--hljs-number); }
  .hljs-title, .hljs-function, .hljs-section, .hljs-name, .hljs-tag, .hljs-meta { color: var(--hljs-title); }
  .hljs-type, .hljs-built_in, .hljs-variable, .hljs-template-variable { color: var(--hljs-builtin); }
  .hljs-operator { color: var(--hljs-operator); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
  :not(pre) > code { background: var(--doc-inline-code-bg, var(--doc-panel)); color: var(--doc-inline-code-fg, inherit); border-radius: 4px; padding: .14em .4em; overflow-wrap: anywhere; }
  a { color: var(--doc-accent); }
  mark { background: var(--doc-mark); color: var(--doc-mark-fg, inherit); padding: 0 3px; border-radius: 2px; }
  .mermaid { text-align: center; margin: 1em 0; }
  .mermaid svg { max-width: 100%; height: auto; }
  .footnotes { font-size: 0.9em; color: var(--doc-muted); border-top: 1px solid var(--doc-border); margin-top: 2em; padding-top: 1em; }
  .contains-task-list { list-style: none; padding-left: 1.4em; }
  .task-list-item > input[type="checkbox"] { margin: 0 .45em 0 -1.35em; accent-color: var(--doc-accent); }
  @page { size: auto; margin: 14mm 15mm; }
  @media print {
    html, body { background: var(--doc-bg); margin: 0; padding: 0; max-width: none; }
    body { font-size: 13.5px; }
    pre { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; overflow-x: visible; }
    h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }
    blockquote, tr, img, .mermaid { break-inside: avoid; page-break-inside: avoid; }
    thead { display: table-header-group; }
    table { font-size: 0.92em; }
  }
`;

const DARK_CSS = `
  :root {
    color-scheme: dark;
    --doc-bg: #181a1f; --doc-fg: #e6e9ee; --doc-muted: #aab1bc; --doc-border: #3b414a;
    --doc-accent: #78a9ff; --doc-panel: #22252b; --doc-code-bg: #22252b;
    --doc-inline-code-bg: #272b33; --doc-inline-code-fg: #e6e9ee;
    --doc-mark: #554b20; --doc-mark-fg: #f8f5e6;
    --hljs-fg: #e6edf3; --hljs-comment: #8b949e; --hljs-keyword: #ff7b72; --hljs-string: #a5d6ff;
    --hljs-number: #79c0ff; --hljs-title: #d2a8ff; --hljs-builtin: #ffa657; --hljs-operator: #c9d1d9;
  }
`;

function exportPageBg(theme: MarkdownTheme, colorTheme: ResolvedTheme): string {
  const dark = colorTheme === "dark";
  switch (theme) {
    case "pixyll": return dark ? "#1e2024" : "#ffffff";
    case "github": return dark ? "#0d1117" : "#ffffff";
    case "newsprint": return dark ? "#201e1c" : "#f3f2ee";
    case "whitey": return dark ? "#1c1d1f" : "#fefefe";
    case "night": return "#363b40";
    case "lapis": return dark ? "#191e26" : "#ffffff";
    case "sepia": return dark ? "#221e1a" : "#faf6ee";
    case "nord": return dark ? "#2e3440" : "#f6f8fb";
    case "academic": return dark ? "#1a1b1d" : "#ffffff";
    default: return dark ? "#181a1f" : "#fcfcfd";
  }
}

function markdownThemeCss(theme: MarkdownTheme, colorTheme: ResolvedTheme): string {
  const dark = colorTheme === "dark";
  const pageRule = `@page { background: ${exportPageBg(theme, colorTheme)}; }`;
  switch (theme) {
    case "pixyll":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#1e2024; --doc-fg:#dde1e7; --doc-muted:#9aa1ad; --doc-border:#555c68; --doc-accent:#a6b8e0; --doc-panel:#23262c; --doc-code-bg:#23262c; --doc-radius:4px; --doc-heading:"Lato","Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif; --hljs-fg:#d5dae2; --hljs-keyword:#f08da9; --hljs-string:#9cc4ff; --hljs-number:#78d5f5; --hljs-comment:#7f8794; --hljs-title:#c792ea; --hljs-builtin:#ffcb6b; --hljs-operator:#89ddff; }
          body { font-family:"Merriweather","PT Serif",Georgia,"Songti SC","SimSun",serif; line-height:1.8; max-width:1060px; }
          h1 { font-size:2.4em; font-weight:800; color:#f2f4f7; }
          h2 { font-size:1.65em; font-weight:700; color:#f2f4f7; }
          a { color:#a6b8e0; text-decoration:underline; }
          :not(pre) > code { background:transparent; color:#a8b1bf; padding:0 2px; border-radius:0; }
          pre { background:#23262c; border:1px solid #424854; border-radius:4px; }
          blockquote { border-left:5px solid #7d8594; background:transparent; font-style:italic; color:#adb4c0; }
          th,td { border:0; padding:11px 12px; text-align:left; }
          thead th { background:transparent; font-family:var(--doc-heading); border-bottom:2px solid #cfd5df; color:#f2f4f7; }
          tbody td { border-top:1px solid #4d535e; }
          tbody tr:first-child td { border-top:0; }`
        : `:root { --doc-bg:#ffffff; --doc-fg:#333333; --doc-muted:#7a7a7a; --doc-border:#d8d8d8; --doc-accent:#463f5c; --doc-panel:#fafafa; --doc-code-bg:#fafafa; --doc-radius:4px; --doc-heading:"Lato","Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif; --hljs-fg:#333333; --hljs-keyword:#a71d5d; --hljs-string:#183691; --hljs-number:#0086b3; --hljs-comment:#8c8c8c; --hljs-title:#795da3; --hljs-builtin:#005cc5; --hljs-operator:#6e7781; }
          body { font-family:"Merriweather","PT Serif",Georgia,"Songti SC","SimSun",serif; line-height:1.8; max-width:1060px; }
          h1 { font-size:2.4em; font-weight:800; color:#333333; }
          h2 { font-size:1.65em; font-weight:700; color:#333333; }
          a { color:#463f5c; text-decoration:underline; }
          :not(pre) > code { background:transparent; color:#7a7a7a; padding:0 2px; border-radius:0; }
          pre { background:#fafafa; border:1px solid #d8d8d8; border-radius:4px; }
          blockquote { border-left:5px solid #7a7a7a; background:transparent; font-style:italic; color:#555555; }
          th,td { border:0; padding:11px 12px; text-align:left; }
          thead th { background:transparent; font-family:var(--doc-heading); border-bottom:2px solid #333333; color:#333333; }
          tbody td { border-top:1px solid #9a9a9a; }
          tbody tr:first-child td { border-top:0; }`}`;
    case "github":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#0d1117; --doc-fg:#e6edf3; --doc-muted:#8b949e; --doc-border:#30363d; --doc-accent:#58a6ff; --doc-panel:#161b22; --doc-code-bg:#161b22; --doc-inline-code-bg:rgba(110,118,129,0.35); --doc-radius:6px; --doc-heading:"Open Sans","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
          body { max-width:1040px; }
          h1,h2 { border-bottom:1px solid #30363d; padding-bottom:0.3em; }
          blockquote { border-left:4px solid #30363d; background:transparent; color:#8b949e; }
          :not(pre) > code { border:1px solid #30363d; border-radius:3px; }
          thead th { background:#161b22; }
          tbody tr:nth-child(2n) td { background:#131820; }`
        : `:root { --doc-bg:#ffffff; --doc-fg:#333333; --doc-muted:#777777; --doc-border:#dfe2e5; --doc-accent:#4183c4; --doc-panel:#f8f8f8; --doc-code-bg:#f8f8f8; --doc-inline-code-bg:#f3f4f4; --doc-radius:6px; --doc-heading:"Open Sans","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
          body { max-width:1040px; }
          h1,h2 { border-bottom:1px solid #eeeeee; padding-bottom:0.3em; }
          blockquote { border-left:4px solid #dfe2e5; background:transparent; color:#777777; }
          :not(pre) > code { border:1px solid #e7eaed; border-radius:3px; }
          thead th { background:#f8f8f8; }
          tbody tr:nth-child(2n) td { background:#f8f8f8; }`}`;
    case "newsprint":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#201e1c; --doc-fg:#e2dcd2; --doc-muted:#a39b8e; --doc-border:#47423c; --doc-accent:#74b0d9; --doc-panel:#322e2a; --doc-code-bg:#2d2926; --doc-inline-code-bg:#35312c; --doc-inline-code-fg:#ece6dc; --doc-radius:0px; --doc-heading:"PT Serif","Times New Roman","Songti SC","SimSun",serif; --hljs-fg:#e2dcd2; --hljs-keyword:#e0826d; --hljs-string:#90c49b; --hljs-number:#7dbbe6; --hljs-comment:#8a8277; --hljs-title:#c7a2e0; --hljs-builtin:#e5b878; --hljs-operator:#b3aa9d; }
          body { font-family:var(--doc-heading); line-height:1.75; max-width:960px; }
          h1 { font-weight:400; border-bottom:1px solid var(--doc-border); padding-bottom:0.45em; }
          blockquote { border-left:5px solid #6e675d; background:transparent; font-style:italic; color:#ada598; }
          th,td { border:0; padding:7px 10px; }
          thead th { background:#36322d; color:#f0eae0; border-bottom:1px solid #47423c; }
          tbody tr:nth-child(2n) td { background:#2a2723; }
          :not(pre) > code { background:#35312c; color:#ece6dc; border-radius:0; padding:0.1em 0.35em; }
          pre { background:#2d2926; border:1px solid #47423c; border-radius:0; }`
        : `:root { --doc-bg:#f3f2ee; --doc-fg:#1f0909; --doc-muted:#656565; --doc-border:#c5c5c5; --doc-accent:#065588; --doc-panel:#dadada; --doc-code-bg:#eae7df; --doc-inline-code-bg:#dadada; --doc-inline-code-fg:#1f0909; --doc-radius:0px; --doc-heading:"PT Serif","Times New Roman","Songti SC","SimSun",serif; --hljs-fg:#1f0909; --hljs-keyword:#8c2d19; --hljs-string:#2c5e3b; --hljs-number:#065588; --hljs-comment:#6e6860; --hljs-title:#6b3e82; --hljs-builtin:#8c4a19; --hljs-operator:#5a534b; }
          body { font-family:var(--doc-heading); line-height:1.75; max-width:960px; }
          h1 { font-weight:400; border-bottom:1px solid var(--doc-border); padding-bottom:0.45em; }
          blockquote { border-left:5px solid #bababa; background:transparent; font-style:italic; color:#656565; }
          th,td { border:0; padding:7px 10px; }
          thead th { background:#dadada; color:#1f0909; border-bottom:1px solid #c5c5c5; }
          tbody tr:nth-child(2n) td { background:#e8e7e7; }
          :not(pre) > code { background:#dadada; color:#1f0909; border-radius:0; padding:0.1em 0.35em; }
          pre { background:#eae7df; border:1px solid #d5d0c4; border-radius:0; }`}`;
    case "whitey":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#1c1d1f; --doc-fg:#dcdfe4; --doc-muted:#9aa0a8; --doc-border:#3b3f45; --doc-accent:#5cb0e5; --doc-panel:#242629; --doc-code-bg:#1f2124; --doc-inline-code-bg:#242629; --doc-radius:0px; --doc-heading:"Vollkorn",Palatino,Georgia,"Songti SC","SimSun",serif; }
          body { font-family:var(--doc-heading); max-width:960px; }
          h1,h2,h3 { text-align:center; font-weight:400; }
          h3 { font-style:italic; }
          h2::after { content:""; display:block; width:100px; height:1px; margin:0.4em auto 0; background:#9aa0a8; }
          blockquote { background:transparent; border-left:1px solid #4b5058; }
          th,td { border:0; border-top:1px solid #353940; }
          thead th { background:transparent; border-top:0; border-bottom:1px solid #4a4f57; }
          :not(pre) > code { background:#242629; border:1px solid #353940; border-radius:2px; }
          pre { background:#1f2124; border:1px solid #3b3f45; border-radius:0; }`
        : `:root { --doc-bg:#fefefe; --doc-fg:#333333; --doc-muted:#777777; --doc-border:#dddddd; --doc-accent:#2484c1; --doc-panel:#f8f8f8; --doc-code-bg:#fafafa; --doc-inline-code-bg:#f4f4f4; --doc-radius:0px; --doc-heading:"Vollkorn",Palatino,Georgia,"Songti SC","SimSun",serif; }
          body { font-family:var(--doc-heading); max-width:960px; }
          h1,h2,h3 { text-align:center; font-weight:400; }
          h3 { font-style:italic; }
          h2::after { content:""; display:block; width:100px; height:1px; margin:0.4em auto 0; background:#2f2f2f; }
          blockquote { background:transparent; border-left:1px solid #dddddd; }
          th,td { border:0; border-top:1px solid #dddddd; }
          thead th { background:transparent; border-top:0; border-bottom:1px solid #cccccc; }
          :not(pre) > code { background:#f4f4f4; border:1px solid #e4e4e4; border-radius:2px; }
          pre { background:#fafafa; border:1px solid #dddddd; border-radius:0; }`}`;
    case "night":
      return `${pageRule}:root { color-scheme:dark; --doc-bg:#363b40; --doc-fg:#b8bfc6; --doc-muted:#9da2a6; --doc-border:#474d54; --doc-accent:#e0e0e0; --doc-panel:#2f3439; --doc-code-bg:#2d3136; --doc-inline-code-bg:rgba(0,0,0,0.22); --doc-inline-code-fg:#d6dde4; --doc-mark:#d3d40e; --doc-mark-fg:#1a1a1a; --doc-radius:0px; --hljs-fg:#d4dadf; --hljs-keyword:#f28b82; --hljs-string:#a5d6a7; --hljs-number:#81d4fa; --hljs-comment:#8b949e; --hljs-title:#d2a8ff; --hljs-builtin:#ffa657; --hljs-operator:#9eb0c2; }
          body { max-width:1040px; }
          h1,h2,h3,h4,h5,h6 { color:#dedede; }
          h1 { font-weight:400; }
          strong { color:#dedede; }
          a { color:#e0e0e0; text-decoration:underline; }
          blockquote { background:transparent; border-left:2px solid #474d54; color:#9da2a6; }
          thead th { background:#2f3439; color:#dedede; }
          :not(pre) > code { background:rgba(0,0,0,0.22); color:#d6dde4; border-radius:2px; }
          pre { background:#2d3136; border:1px solid #474d54; border-radius:0; }`;
    case "lapis":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#191e26; --doc-fg:#d9e1ec; --doc-muted:#8f9eb3; --doc-border:#313b4c; --doc-accent:#7aa2f7; --doc-panel:#212834; --doc-code-bg:#1f2631; --doc-inline-code-bg:#252e3d; --doc-inline-code-fg:#9ec0f5; --doc-radius:6px; --hljs-keyword:#82aaff; --hljs-string:#80cbc4; --hljs-number:#f7b872; --hljs-comment:#6e7d94; }
          body { max-width:1040px; }
          h1,h2,h3 { color:#7ea8e6; }
          h1::after { content:""; display:block; width:60px; height:3px; margin-top:0.3em; border-radius:2px; background:var(--doc-accent); }
          h2 { border-left:4px solid var(--doc-accent); padding-left:10px; }
          blockquote { background:#1e2531; border-left:4px solid #6a93d4; color:#a2b1c6; }
          thead th { background:#222a37; color:#7ea8e6; }
          tbody tr:nth-child(2n) td { background:#1e2430; }`
        : `:root { --doc-bg:#ffffff; --doc-fg:#2b323b; --doc-muted:#647182; --doc-border:#dce4ef; --doc-accent:#4870ac; --doc-panel:#f3f6fa; --doc-code-bg:#f6f8fb; --doc-inline-code-bg:#eef3f9; --doc-inline-code-fg:#315485; --doc-radius:6px; --hljs-keyword:#3b5998; --hljs-string:#2d7a64; --hljs-number:#b45309; --hljs-comment:#8592a6; }
          body { max-width:1040px; }
          h1,h2,h3 { color:#36598a; }
          h1::after { content:""; display:block; width:60px; height:3px; margin-top:0.3em; border-radius:2px; background:var(--doc-accent); }
          h2 { border-left:4px solid var(--doc-accent); padding-left:10px; }
          blockquote { background:#f4f7fb; border-left:4px solid #4870ac; color:#516075; }
          thead th { background:#eef3f9; color:#36598a; }
          tbody tr:nth-child(2n) td { background:#f8fafd; }`}`;
    case "sepia":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#221e1a; --doc-fg:#e5dcd0; --doc-muted:#a69989; --doc-border:#403830; --doc-accent:#d9915b; --doc-panel:#2b2621; --doc-code-bg:#29241f; --doc-inline-code-bg:#302a24; --doc-inline-code-fg:#eab282; --doc-radius:4px; --doc-heading:"Georgia","Songti SC","Noto Serif SC","SimSun",serif; --hljs-keyword:#e68c6c; --hljs-string:#9cc48a; --hljs-number:#e0b065; --hljs-comment:#8a7e70; }
          body { font-family:var(--doc-heading); line-height:1.85; max-width:960px; }
          h1 { border-bottom:1px solid #403830; padding-bottom:0.35em; color:#f4ece0; }
          blockquote { background:transparent; border-left:3.5px solid #b87c4b; font-style:italic; color:#bdb0a0; }
          th,td { border:0; border-bottom:1px solid #403830; }
          thead th { background:#2b2621; border-top:1.5px solid #b87c4b; border-bottom:1.5px solid #b87c4b; }`
        : `:root { --doc-bg:#faf6ee; --doc-fg:#3a3026; --doc-muted:#7c6d5c; --doc-border:#dfd5c3; --doc-accent:#a84b31; --doc-panel:#f1eadc; --doc-code-bg:#f2ebdd; --doc-inline-code-bg:#efe7d8; --doc-inline-code-fg:#7e3622; --doc-radius:4px; --doc-heading:"Georgia","Songti SC","Noto Serif SC","SimSun",serif; --hljs-keyword:#a84b31; --hljs-string:#4d7041; --hljs-number:#9c6615; --hljs-comment:#8f806e; }
          body { font-family:var(--doc-heading); line-height:1.85; max-width:960px; }
          h1 { border-bottom:1px solid #dfd5c3; padding-bottom:0.35em; color:#2b2118; }
          blockquote { background:transparent; border-left:3.5px solid #c28b5a; font-style:italic; color:#665848; }
          th,td { border:0; border-bottom:1px solid #dfd5c3; }
          thead th { background:#f1eadc; border-top:1.5px solid #c28b5a; border-bottom:1.5px solid #c28b5a; }`}`;
    case "nord":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#2e3440; --doc-fg:#eceff4; --doc-muted:#9aa7bd; --doc-border:#434c5e; --doc-accent:#88c0d0; --doc-panel:#3b4252; --doc-code-bg:#272c36; --doc-inline-code-bg:#3b4252; --doc-inline-code-fg:#8fbcbb; --doc-radius:6px; --hljs-keyword:#81a1c1; --hljs-string:#a3be8c; --hljs-number:#b48ead; --hljs-comment:#6c7a96; }
          body { max-width:1040px; }
          h1,h2,h3 { color:#88c0d0; }
          blockquote { background:#353c4a; border-left:3.5px solid #81a1c1; color:#c2cad8; }
          thead th { background:#3b4252; color:#88c0d0; }
          tbody tr:nth-child(2n) td { background:#333a47; }`
        : `:root { --doc-bg:#f6f8fb; --doc-fg:#2e3440; --doc-muted:#616e88; --doc-border:#d8dee9; --doc-accent:#5e81ac; --doc-panel:#eceff4; --doc-code-bg:#eceff4; --doc-inline-code-bg:#e5e9f0; --doc-inline-code-fg:#434c5e; --doc-radius:6px; --hljs-keyword:#5e81ac; --hljs-string:#6c8e68; --hljs-number:#b48ead; --hljs-comment:#7b88a1; }
          body { max-width:1040px; }
          blockquote { background:#edf1f7; border-left:3.5px solid #81a1c1; color:#4c566a; }
          thead th { background:#e5e9f0; color:#2e3440; }
          tbody tr:nth-child(2n) td { background:#f3f6fa; }`}`;
    case "academic":
      return `${pageRule}${dark
        ? `:root { --doc-bg:#1a1b1d; --doc-fg:#e2e2df; --doc-muted:#9e9e99; --doc-border:#3a3b40; --doc-accent:#7aa7dc; --doc-panel:#232427; --doc-code-bg:#222326; --doc-inline-code-bg:#27282c; --doc-radius:0px; --doc-heading:"STIX Two Text","Cambria","Georgia","Songti SC","SimSun",serif; }
          body { font-family:var(--doc-heading); line-height:1.85; max-width:960px; }
          h1 { text-align:center; border-bottom:1px solid var(--doc-border); padding-bottom:0.35em; color:#f4f4f0; }
          blockquote { background:transparent; border-left:2.5px solid #9a9a95; font-style:italic; color:#b5b5b0; }
          table { border-top:2px solid #f4f4f0; border-bottom:2px solid #f4f4f0; }
          th,td { border:0; padding:8px 14px; }
          th { background:transparent; border-bottom:1px solid #f4f4f0; }`
        : `:root { --doc-bg:#ffffff; --doc-fg:#1a1a1a; --doc-muted:#595959; --doc-border:#d9d9d5; --doc-accent:#1d4e89; --doc-panel:#f7f7f5; --doc-code-bg:#f8f8f6; --doc-inline-code-bg:#f2f2ef; --doc-radius:0px; --doc-heading:"STIX Two Text","Cambria","Georgia","Songti SC","SimSun",serif; }
          body { font-family:var(--doc-heading); line-height:1.85; max-width:960px; }
          h1 { text-align:center; border-bottom:1px solid var(--doc-border); padding-bottom:0.35em; color:#111111; }
          blockquote { background:transparent; border-left:2.5px solid #333333; font-style:italic; color:#444444; }
          table { border-top:2px solid #111111; border-bottom:2px solid #111111; }
          th,td { border:0; padding:8px 14px; }
          th { background:transparent; border-bottom:1px solid #111111; }`}`;
    case "vue":
      return `${pageRule}${dark
        ? `:root { --doc-border:#3a3a3a; --doc-accent:#42d392; --doc-panel:#242424; --doc-code-bg:#242424; --doc-radius:4px; }`
        : `:root { --doc-border:#e2e2e3; --doc-accent:#42b883; --doc-panel:#f3f5f7; --doc-code-bg:#f3f5f7; --doc-radius:4px; }`}`;
    case "minimal":
      return `${pageRule}${dark
        ? `:root { --doc-border:#343939; --doc-accent:#9aacaa; --doc-panel:#242727; --doc-code-bg:#242727; --doc-radius:2px; }`
        : `:root { --doc-border:#e0e5e4; --doc-accent:#647a76; --doc-panel:#f5f7f7; --doc-code-bg:#f5f7f7; --doc-radius:2px; }`}`;
    default:
      return pageRule;
  }
}

/** 允许常用排版标签，同时剔除 script、事件属性和危险 URL。 */
const SANITIZE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...HTML_INLINE_TAGS, ...HTML_BLOCK_TAGS])],
  strip: [...new Set([...(defaultSchema.strip ?? []), ...HTML_STRIP_TAGS])],
  protocols: { ...defaultSchema.protocols, href: HTML_LINK_PROTOCOLS, src: HTML_IMAGE_PROTOCOLS },
  attributes: {
    ...defaultSchema.attributes,
    details: ["open"],
    img: [...(defaultSchema.attributes?.img ?? []), ["width", HTML_IMAGE_SIZE], ["height", HTML_IMAGE_SIZE]],
  },
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
    .use(rehypeHighlight, {
      languages: HLJS_LANGUAGES,
      aliases: HLJS_ALIASES,
    })
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
  pendingImages: ReadonlyMap<string, string> = new Map(),
): Promise<string> {
  const effectiveTheme: ResolvedTheme = markdownTheme === "night" ? "dark" : theme;
  let bodyHtml = await markdownToBodyHtml(md, effectiveTheme);
  if (embedImages) {
    bodyHtml = await embedImagesInHtml(bodyHtml, mdPath ?? null, pendingImages);
  }
  const exportKatexCss = embedImages ? await embedFontUrlsInCss(katexCss) : katexCss;
  const themeCss = `${effectiveTheme === "dark" ? DARK_CSS : ""}${markdownThemeCss(markdownTheme, effectiveTheme)}`;
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

function pendingImageDataUrl(
  pendingImages: ReadonlyMap<string, string>,
  source: string,
): string | null {
  const normalized = source.replace(/^\.\//, "");
  const decoded = (() => {
    try { return decodeURIComponent(normalized); } catch { return normalized; }
  })();
  return pendingImages.get(source)
    ?? pendingImages.get(normalized)
    ?? pendingImages.get(decoded)
    ?? null;
}

export async function embedImagesInHtml(
  html: string,
  mdPath: string | null,
  pendingImages: ReadonlyMap<string, string> = new Map(),
): Promise<string> {
  const re = /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi;
  const parts: Array<{ match: string; src: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    parts.push({ match: m[0], src: m[2] });
  }
  let out = html;
  for (const { match, src } of parts) {
    if (src.startsWith("data:") || src.startsWith("//") || /^https?:/i.test(src)) continue;
    const pendingDataUrl = pendingImageDataUrl(pendingImages, src);
    if (pendingDataUrl) {
      out = out.replace(match, match.replace(src, pendingDataUrl));
      continue;
    }
    if (!mdPath) continue;
    const abs = resolveAssetPath(mdPath, src);
    const dataUrl = await fileToDataUrl(abs);
    if (dataUrl) {
      out = out.replace(match, match.replace(src, dataUrl));
    }
  }
  return out;
}
