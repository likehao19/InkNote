/** YAML Front Matter 解析 */

export interface FrontMatter {
  from: number;
  to: number;
  raw: string;
  data: Record<string, string>;
}

export function parseFrontMatter(doc: string): FrontMatter | null {
  if (!doc.startsWith("---")) return null;
  const end = doc.indexOf("\n---", 3);
  if (end < 0) return null;
  const blockEnd = end + 4; // \n---
  const raw = doc.slice(4, end);
  const data: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line.trim());
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return { from: 0, to: blockEnd + (doc[blockEnd] === "\n" ? 1 : 0), raw, data };
}

export function formatFrontMatter(data: Record<string, string>): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

export function updateFrontMatter(doc: string, data: Record<string, string>): string {
  const fm = parseFrontMatter(doc);
  const block = formatFrontMatter(data);
  if (fm) return block + doc.slice(fm.to);
  return block + doc;
}

export function bodyWithoutFrontMatter(doc: string): string {
  const fm = parseFrontMatter(doc);
  return fm ? doc.slice(fm.to) : doc;
}
