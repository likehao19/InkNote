/** 将常见 HTML 剪贴板内容转为简易 Markdown */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walk(doc.body).trim();
}

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(walk).join("");

  switch (tag) {
    case "br":
      return "\n";
    case "p":
    case "div":
      return `${inner}\n\n`;
    case "h1":
      return `# ${inner.trim()}\n\n`;
    case "h2":
      return `## ${inner.trim()}\n\n`;
    case "h3":
      return `### ${inner.trim()}\n\n`;
    case "h4":
      return `#### ${inner.trim()}\n\n`;
    case "h5":
      return `##### ${inner.trim()}\n\n`;
    case "h6":
      return `###### ${inner.trim()}\n\n`;
    case "strong":
    case "b":
      return `**${inner}**`;
    case "em":
    case "i":
      return `*${inner}*`;
    case "code":
      return `\`${inner}\``;
    case "pre":
      return `\n\`\`\`\n${el.textContent ?? ""}\n\`\`\`\n\n`;
    case "a":
      const href = el.getAttribute("href") ?? "";
      return href ? `[${inner}](${href})` : inner;
    case "img":
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      return src ? `![${alt}](${src})` : "";
    case "ul":
      return `${inner}\n`;
    case "ol":
      return `${inner}\n`;
    case "li":
      const parent = el.parentElement?.tagName.toLowerCase();
      const bullet = parent === "ol" ? "1. " : "- ";
      return `${bullet}${inner.trim()}\n`;
    case "blockquote":
      return inner
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => `> ${l}`)
        .join("\n") + "\n\n";
    case "hr":
      return "---\n\n";
    case "script":
    case "style":
      return "";
    default:
      return inner;
  }
}
