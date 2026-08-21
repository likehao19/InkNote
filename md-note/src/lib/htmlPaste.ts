/** 将常见 HTML 剪贴板内容转换为 Markdown。 */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walk(doc.body).trim();
}

function walkChildren(node: Node, listDepth = 0): string {
  return Array.from(node.childNodes).map((child) => walk(child, listDepth)).join("");
}

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  return longest;
}

function inlineCode(text: string): string {
  const fence = "`".repeat(Math.max(1, longestBacktickRun(text) + 1));
  const pad = text.startsWith("`") || text.endsWith("`") || /^\s|\s$/.test(text) ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function renderList(el: HTMLElement, depth: number): string {
  const ordered = el.tagName.toLowerCase() === "ol";
  const start = ordered ? Number(el.getAttribute("start") ?? "1") || 1 : 1;
  const items = Array.from(el.children).filter((child) => child.tagName.toLowerCase() === "li");
  return items.map((item, index) =>
    renderListItem(item as HTMLElement, depth, ordered, start + index)
  ).join("");
}

function renderListItem(
  li: HTMLElement,
  depth: number,
  ordered: boolean,
  index: number,
): string {
  const nested: HTMLElement[] = [];
  const content = Array.from(li.childNodes).map((child) => {
    if (child instanceof HTMLElement && /^(ul|ol)$/i.test(child.tagName)) {
      nested.push(child);
      return "";
    }
    return walk(child, depth);
  }).join("").trim();

  const checkbox = Array.from(li.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .find((input) => {
      for (let parent = input.parentElement; parent && parent !== li; parent = parent.parentElement) {
        if (/^(ul|ol)$/i.test(parent.tagName)) return false;
      }
      return true;
    });
  const task = checkbox ? `[${checkbox.checked ? "x" : " "}] ` : "";
  const marker = ordered ? `${index}. ` : "- ";
  const indent = "  ".repeat(depth);
  const continuation = `${indent}${" ".repeat(marker.length)}`;
  const body = content
    .split("\n")
    .map((line, i) => i === 0 ? line : `${continuation}${line}`)
    .join("\n");
  const children = nested.map((list) => renderList(list, depth + 1)).join("");
  return `${indent}${marker}${task}${body}\n${children}`;
}

function escapeTableCell(text: string): string {
  return text.trim().replace(/\r?\n+/g, "<br>").replace(/\|/g, "\\|");
}

function renderTable(el: HTMLElement): string {
  const rows = Array.from(el.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => /^(th|td)$/i.test(cell.tagName))
        .map((cell) => escapeTableCell(walkChildren(cell))),
    )
    .filter((row) => row.length > 0);
  if (!rows.length) return "";

  const cols = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [
    ...row,
    ...Array(Math.max(0, cols - row.length)).fill(""),
  ]);
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return `${line(normalized[0])}\n${line(Array(cols).fill("---"))}\n${normalized.slice(1).map(line).join("\n")}\n\n`;
}

function walk(node: Node, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = walkChildren(el, listDepth);

  switch (tag) {
    case "br": return "\n";
    case "p":
    case "div": return `${inner}\n\n`;
    case "h1": return `# ${inner.trim()}\n\n`;
    case "h2": return `## ${inner.trim()}\n\n`;
    case "h3": return `### ${inner.trim()}\n\n`;
    case "h4": return `#### ${inner.trim()}\n\n`;
    case "h5": return `##### ${inner.trim()}\n\n`;
    case "h6": return `###### ${inner.trim()}\n\n`;
    case "strong":
    case "b": return `**${inner}**`;
    case "em":
    case "i": return `*${inner}*`;
    case "del":
    case "s": return `~~${inner}~~`;
    case "mark": return `==${inner}==`;
    case "u": return `<u>${inner}</u>`;
    case "sup": return `<sup>${inner}</sup>`;
    case "sub": return `<sub>${inner}</sub>`;
    case "kbd": return `<kbd>${inner}</kbd>`;
    case "code":
      return el.parentElement?.tagName.toLowerCase() === "pre"
        ? el.textContent ?? ""
        : inlineCode(el.textContent ?? "");
    case "pre": {
      const text = el.textContent ?? "";
      const code = el.querySelector("code");
      const lang = /(?:^|\s)language-([^\s]+)/.exec(code?.className ?? "")?.[1] ?? "";
      const fence = "`".repeat(Math.max(3, longestBacktickRun(text) + 1));
      return `${fence}${lang}\n${text.replace(/\n+$/, "")}\n${fence}\n\n`;
    }
    case "a": {
      const href = el.getAttribute("href") ?? "";
      return href ? `[${inner}](${href})` : inner;
    }
    case "img": {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      return src ? `![${alt}](${src})` : "";
    }
    case "ul":
    case "ol": return renderList(el, listDepth);
    case "li": return inner;
    case "table": return renderTable(el);
    case "blockquote":
      return inner
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n";
    case "hr": return "---\n\n";
    case "input": return "";
    case "script":
    case "style": return "";
    default: return inner;
  }
}
