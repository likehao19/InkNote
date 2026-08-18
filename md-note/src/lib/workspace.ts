const FOLDER_KEY = "mdnote.lastFolder";
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

export type SavedSidebarTab = "files" | "outline" | "recent";

export function getSidebarTab(): SavedSidebarTab {
  const v = localStorage.getItem(SIDEBAR_TAB_KEY) ?? localStorage.getItem("mdnote.defaultSidebarTab");
  return v === "outline" || v === "recent" ? v : "files";
}

export function setSidebarTab(tab: SavedSidebarTab) {
  localStorage.setItem(SIDEBAR_TAB_KEY, tab);
}
