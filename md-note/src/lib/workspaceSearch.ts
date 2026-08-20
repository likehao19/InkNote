import { listDir, readFile } from "./tauri";
import { basename } from "./paths";

export interface SearchMatch {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

const MD_EXT = /\.(md|markdown|txt)$/i;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 512_000;
const MAX_MATCHES = 80;

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const queue = [root];

  while (queue.length > 0 && out.length < MAX_FILES) {
    const dir = queue.shift()!;
    try {
      const entries = await listDir(dir);
      for (const e of entries) {
        if (e.is_dir) {
          if (!e.name.startsWith(".")) queue.push(e.path);
        } else if (MD_EXT.test(e.name)) {
          out.push(e.path);
          if (out.length >= MAX_FILES) break;
        }
      }
    } catch {
      /* skip unreadable dirs */
    }
  }

  return out;
}

async function resolveSearchFiles(folderPath: string | null, recentFiles: string[]): Promise<string[]> {
  const paths = new Set<string>();

  if (folderPath) {
    const files = await collectMarkdownFiles(folderPath);
    for (const f of files) paths.add(f);
  }

  for (const p of recentFiles) {
    if (MD_EXT.test(p)) paths.add(p);
  }

  return [...paths];
}

export async function listWorkspaceFiles(
  folderPath: string | null,
  recentFiles: string[],
): Promise<string[]> {
  return resolveSearchFiles(folderPath, recentFiles);
}

export function scorePathMatch(query: string, path: string): number {
  const name = basename(path).toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (path.toLowerCase().includes(q)) return 40;
  return 0;
}

export interface SearchOptions {
  filenameOnly?: boolean;
  useRegex?: boolean;
}

function findMatchesInText(
  path: string,
  text: string,
  query: string,
  opts: SearchOptions,
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const name = basename(path);

  if (opts.filenameOnly) {
    let idx = -1;
    let length = query.length;
    if (opts.useRegex) {
      try {
        const match = new RegExp(query, "i").exec(name);
        if (match) {
          idx = match.index;
          length = match[0].length;
        }
      } catch {
        return matches;
      }
    } else {
      idx = name.toLowerCase().indexOf(query.toLowerCase());
    }
    if (idx >= 0) {
      matches.push({
        path,
        line: 1,
        lineText: name,
        matchStart: idx,
        matchEnd: idx + length,
      });
    }
    return matches;
  }

  const lines = text.split("\n");

  if (opts.useRegex) {
    try {
      const re = new RegExp(query, "gi");
      if (name.match(re)) {
        const m = name.match(re);
        if (m?.[0]) {
          const idx = name.toLowerCase().indexOf(m[0].toLowerCase());
          matches.push({
            path,
            line: 1,
            lineText: name,
            matchStart: idx,
            matchEnd: idx + m[0].length,
          });
        }
      }
      for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
        const line = lines[i];
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) && matches.length < MAX_MATCHES) {
          matches.push({
            path,
            line: i + 1,
            lineText: line,
            matchStart: m.index,
            matchEnd: m.index + m[0].length,
          });
          if (m[0].length === 0) re.lastIndex = m.index + 1;
        }
      }
    } catch {
      return matches;
    }
    return matches;
  }

  const q = query.toLowerCase();
  const nameLower = name.toLowerCase();
  if (nameLower.includes(q)) {
    matches.push({
      path,
      line: 1,
      lineText: name,
      matchStart: nameLower.indexOf(q),
      matchEnd: nameLower.indexOf(q) + query.length,
    });
  }

  for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    let from = 0;
    while (from < lower.length && matches.length < MAX_MATCHES) {
      const idx = lower.indexOf(q, from);
      if (idx === -1) break;
      matches.push({
        path,
        line: i + 1,
        lineText: line,
        matchStart: idx,
        matchEnd: idx + query.length,
      });
      from = idx + query.length;
    }
  }

  return matches;
}

export async function searchWorkspace(
  folderPath: string | null,
  recentFiles: string[],
  query: string,
  opts: SearchOptions = {},
): Promise<{ matches: SearchMatch[]; fileCount: number }> {
  const q = query.trim();
  if (!q) return { matches: [], fileCount: 0 };

  const files = await resolveSearchFiles(folderPath, recentFiles);
  const matches: SearchMatch[] = [];

  for (const path of files) {
    if (matches.length >= MAX_MATCHES) break;
    if (opts.filenameOnly) {
      const fileMatches = findMatchesInText(path, "", q, opts);
      for (const m of fileMatches) {
        matches.push(m);
        if (matches.length >= MAX_MATCHES) break;
      }
      continue;
    }
    try {
      const text = await readFile(path);
      if (text.length > MAX_FILE_BYTES) continue;
      const fileMatches = findMatchesInText(path, text, q, opts);
      for (const m of fileMatches) {
        matches.push(m);
        if (matches.length >= MAX_MATCHES) break;
      }
    } catch {
      /* skip */
    }
  }

  return { matches, fileCount: files.length };
}

export function hasSearchScope(folderPath: string | null, recentFiles: string[]): boolean {
  return folderPath !== null || recentFiles.some((p) => MD_EXT.test(p));
}
