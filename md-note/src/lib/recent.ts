import { getRecentFilesLimit } from "./preferences";

const KEY = "mdnote.recent";

export { getRecentFilesLimit } from "./preferences";

export function getRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return list.slice(0, getRecentFilesLimit());
  } catch {
    return [];
  }
}

export function addRecentFile(path: string) {
  const limit = getRecentFilesLimit();
  const list = getRecentFiles().filter((p) => p !== path);
  list.unshift(path);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, limit)));
}

export function removeRecentFile(path: string) {
  const list = getRecentFiles().filter((p) => p !== path);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearRecentFiles() {
  localStorage.removeItem(KEY);
}

export function trimRecentFiles(limit: number) {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, limit)));
  } catch {
    localStorage.removeItem(KEY);
  }
}
