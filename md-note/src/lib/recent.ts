import { getRecentFilesLimit } from "./preferences";
import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.recent";

export { getRecentFilesLimit } from "./preferences";

export function getRecentFiles(): string[] {
  try {
    const raw = getStoredValue(KEY);
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
  setStoredValue(KEY, JSON.stringify(list.slice(0, limit)));
}

export function removeRecentFile(path: string) {
  const list = getRecentFiles().filter((p) => p !== path);
  setStoredValue(KEY, JSON.stringify(list));
}

export function clearRecentFiles() {
  removeStoredValue(KEY);
}

export function trimRecentFiles(limit: number) {
  try {
    const raw = getStoredValue(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    setStoredValue(KEY, JSON.stringify(list.slice(0, limit)));
  } catch {
    removeStoredValue(KEY);
  }
}
