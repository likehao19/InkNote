const KEY = "mdnote.recent";
const MAX = 12;

export function getRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(path: string) {
  const list = getRecentFiles().filter((p) => p !== path);
  list.unshift(path);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function removeRecentFile(path: string) {
  const list = getRecentFiles().filter((p) => p !== path);
  localStorage.setItem(KEY, JSON.stringify(list));
}
