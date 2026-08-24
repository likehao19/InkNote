import { frontMatterLineCount } from "./frontmatter";

export interface MarkdownOutlineItem {
  level: number;
  text: string;
  line: number;
  anchor: string;
}

function headingText(value: string): string {
  return value
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

function baseAnchor(value: string): string {
  return headingText(value)
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractMarkdownOutline(content: string): MarkdownOutlineItem[] {
  const items: Omit<MarkdownOutlineItem, "anchor">[] = [];
  const lines = content.split("\n");
  const start = frontMatterLineCount(content);
  let fence: string | null = null;

  for (let index = start; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      continue;
    }
    if (fence) continue;

    const atx = /^(#{1,6})\s+(.+)$/.exec(line);
    if (atx) {
      const text = headingText(atx[2]);
      if (text) items.push({ level: atx[1].length, text, line: index + 1 });
      continue;
    }

    const text = headingText(line.trim());
    if (!text) continue;
    const underline = lines[index + 1]?.trim() ?? "";
    if (/^=+\s*$/.test(underline)) items.push({ level: 1, text, line: index + 1 });
    else if (/^-+\s*$/.test(underline)) items.push({ level: 2, text, line: index + 1 });
  }

  const counts = new Map<string, number>();
  return items.map((item) => {
    const base = baseAnchor(item.text) || "section";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return { ...item, anchor: count ? `${base}-${count}` : base };
  });
}

export function buildMarkdownToc(content: string): string {
  const items = extractMarkdownOutline(content);
  if (!items.length) return "";
  const minimumLevel = Math.min(...items.map((item) => item.level));
  return items
    .map((item) => `${"  ".repeat(Math.max(0, item.level - minimumLevel))}- [${item.text}](#${item.anchor})`)
    .join("\n");
}
