/** YAML Front Matter 解析 */

export interface FrontMatter {
  from: number;
  to: number;
  raw: string;
  data: Record<string, string>;
}

/** front matter 不可能很长，限定扫描范围避免大文档全文扫描 */
const MAX_SCAN = 8192;

/**
 * 按行解析文档开头的 YAML front matter。
 *
 * 要求首行恰好是 `---`，并且必须能在扫描范围内找到恰好是 `---` / `...` 的闭合行；
 * 否则视为普通正文（例如以分割线开头的文档不会被误吞）。
 */
export function parseFrontMatter(doc: string): FrontMatter | null {
  if (!doc.startsWith("---")) return null;

  const firstBreak = doc.indexOf("\n");
  if (firstBreak < 0) return null;
  if (doc.slice(0, firstBreak).replace(/\r$/, "").trim() !== "---") return null;

  const limit = Math.min(doc.length, MAX_SCAN);
  const data: Record<string, string> = {};
  const rawLines: string[] = [];
  let pos = firstBreak + 1;

  while (pos < limit) {
    const next = doc.indexOf("\n", pos);
    const lineEnd = next < 0 ? doc.length : next;
    const line = doc.slice(pos, lineEnd).replace(/\r$/, "");
    const trimmed = line.trim();

    if (trimmed === "---" || trimmed === "...") {
      // 至少要解析出一个 key，否则以 `---` 分割线开头的普通文档
      // 会把两条分割线之间的正文整段当成 front matter 吞掉
      if (Object.keys(data).length === 0) return null;
      const to = lineEnd + (doc[lineEnd] === "\n" ? 1 : 0);
      return { from: 0, to, raw: rawLines.join("\n"), data };
    }

    rawLines.push(line);
    const m = /^([\w.-]+)\s*:\s*(.*)$/.exec(line);
    if (m) data[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");

    if (next < 0) break;
    pos = next + 1;
  }

  return null;
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

/** front matter 占用的行数（用于大纲等按行处理的场景，0 表示没有） */
export function frontMatterLineCount(doc: string): number {
  const fm = parseFrontMatter(doc);
  if (!fm) return 0;
  let lines = 0;
  for (let i = 0; i < fm.to; i++) if (doc[i] === "\n") lines++;
  return doc[fm.to - 1] === "\n" ? lines : lines + 1;
}
