import { getDefaultSidebarTab } from "./preferences";
import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";

const FOLDER_KEY = "mdnote.lastFolder";
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

export function getLastFile(): string | null {
  return getStoredValue(FILE_KEY);
}

export function setLastFile(path: string) {
  setStoredValue(FILE_KEY, path);
}

export function clearLastFile() {
  removeStoredValue(FILE_KEY);
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
