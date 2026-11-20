export const HTML_INLINE_TAGS = [
  "a", "b", "br", "code", "del", "em", "i", "img", "ins", "kbd", "mark",
  "s", "span", "strong", "sub", "sup", "u",
];

export const HTML_BLOCK_TAGS = [
  "blockquote", "dd", "details", "div", "dl", "dt", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "li", "ol", "p", "pre",
  "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
];

export const HTML_STRIP_TAGS = [
  "script", "style", "iframe", "object", "embed", "template", "noscript",
  "form", "button", "textarea", "select", "svg", "math",
];

export const HTML_IMAGE_SIZE = /^\d{1,4}$/;
export const HTML_LINK_PROTOCOLS = ["http", "https", "mailto"];
export const HTML_IMAGE_PROTOCOLS = ["http", "https"];

export function safeHtmlUrl(raw: string, kind: "link" | "image"): string | null {
  const url = raw.trim();
  if (!url || /[\u0000-\u001f\u007f\\]/.test(url)) return null;
  const protocol = /^([a-z][a-z\d+.-]*):/i.exec(url.replace(/\s/g, ""))?.[1].toLowerCase();
  const allowed = kind === "image" ? HTML_IMAGE_PROTOCOLS : HTML_LINK_PROTOCOLS;
  if (protocol && !allowed.includes(protocol)) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}
