import { getDefaultSidebarTab } from "./preferences";

const FOLDER_KEY = "mdnote.lastFolder";
const FILE_KEY = "mdnote.lastFile";
const SIDEBAR_TAB_KEY = "mdnote.sidebarTab";

export function getLastFolder(): string | null {
  return localStorage.getItem(FOLDER_KEY);
}

export function setLastFolder(path: string) {
  localStorage.setItem(FOLDER_KEY, path);
}

export function clearLastFolder() {
  localStorage.removeItem(FOLDER_KEY);
}

export function getLastFile(): string | null {
  return localStorage.getItem(FILE_KEY);
}

export function setLastFile(path: string) {
  localStorage.setItem(FILE_KEY, path);
}

export function clearLastFile() {
  localStorage.removeItem(FILE_KEY);
}

export type SavedSidebarTab = "files" | "outline" | "recent";

export function getSidebarTab(): SavedSidebarTab {
  const v = localStorage.getItem(SIDEBAR_TAB_KEY);
  if (v === "outline" || v === "recent" || v === "files") return v;
  return getDefaultSidebarTab();
}

export function setSidebarTab(tab: SavedSidebarTab) {
  localStorage.setItem(SIDEBAR_TAB_KEY, tab);
}
