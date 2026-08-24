import { getDefaultSidebarTab } from "./preferences";
import { isPathUnder, remapPath } from "./paths";
import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";

const FOLDER_KEY = "mdnote.lastFolder";
const FOLDERS_KEY = "mdnote.workspaceFolders";
const FILE_KEY = "mdnote.lastFile";
const SIDEBAR_TAB_KEY = "mdnote.sidebarTab";

export function getLastFolder(): string | null {
  return getStoredValue(FOLDER_KEY);
}

export function setLastFolder(path: string) {
  setStoredValue(FOLDER_KEY, path);
}

export function clearLastFolder() {
  removeStoredValue(FOLDER_KEY);
}

/** 多根工作区；首次升级时自动接管旧版单目录配置。 */
export function getWorkspaceFolders(): string[] {
  const raw = getStoredValue(FOLDERS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.filter((path): path is string => typeof path === "string" && path.trim().length > 0))];
      }
    } catch {
      /* fall through to the legacy single-folder value */
    }
  }
  const legacy = getLastFolder();
  return legacy ? [legacy] : [];
}

export function setWorkspaceFolders(paths: string[]) {
  const folders = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  setStoredValue(FOLDERS_KEY, JSON.stringify(folders));
  if (folders.length) setLastFolder(folders[folders.length - 1]);
  else clearLastFolder();
}

export function getLastFile(): string | null {
  return getStoredValue(FILE_KEY);
}

export function setLastFile(path: string) {
  setStoredValue(FILE_KEY, path);
}

export function clearLastFile() {
  removeStoredValue(FILE_KEY);
}

export function remapLastFile(oldPath: string, newPath: string) {
  const path = getLastFile();
  if (path) setLastFile(remapPath(path, oldPath, newPath));
}

export function clearLastFileUnder(path: string) {
  const current = getLastFile();
  if (current && isPathUnder(current, path)) clearLastFile();
}

export type SavedSidebarTab = "files" | "outline" | "recent";

export function getSidebarTab(): SavedSidebarTab {
  const v = getStoredValue(SIDEBAR_TAB_KEY);
  if (v === "outline" || v === "recent" || v === "files") return v;
  return getDefaultSidebarTab();
}

export function setSidebarTab(tab: SavedSidebarTab) {
  setStoredValue(SIDEBAR_TAB_KEY, tab);
}
