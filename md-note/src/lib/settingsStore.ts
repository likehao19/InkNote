import { invoke } from "@tauri-apps/api/core";

type SettingsObject = Record<string, unknown>;

const SETTINGS_PATHS: Record<string, string> = {
  "inknote.locale": "locale",
  "mdnote.theme": "appearance.colorTheme",
  "mdnote.markdownTheme": "appearance.markdownTheme",
  "mdnote.customCss": "appearance.customCssPath",
  "mdnote.lastFolder": "workspace.lastFolder",
  "mdnote.lastFile": "workspace.lastFile",
  "mdnote.sidebarTab": "workspace.sidebarTab",
  "mdnote.recent": "workspace.recentFiles",
};

let settings: SettingsObject = {};
let initialized = false;
let saveChain: Promise<unknown> = Promise.resolve();

function pathFor(key: string): string[] {
  const mapped = SETTINGS_PATHS[key]
    ?? (key.startsWith("mdnote.") ? `preferences.${key.slice("mdnote.".length)}` : key);
  return mapped.split(".");
}

function readPath(path: string[]): unknown {
  let current: unknown = settings;
  for (const part of path) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as SettingsObject)[part];
  }
  return current;
}

function writePath(path: string[], value: unknown) {
  let current = settings;
  for (const part of path.slice(0, -1)) {
    const child = current[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[part] = {};
    current = current[part] as SettingsObject;
  }
  current[path[path.length - 1]] = value;
}

function removePath(path: string[]) {
  let current: SettingsObject = settings;
  for (const part of path.slice(0, -1)) {
    const child = current[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) return;
    current = child as SettingsObject;
  }
  delete current[path[path.length - 1]];
}

function canInvokeTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function persist() {
  if (!canInvokeTauri()) return;
  const snapshot = structuredClone(settings);
  saveChain = saveChain
    .catch(() => undefined)
    .then(() => invoke<void>("save_app_settings", { settings: snapshot }))
    .catch((error) => console.error("保存设置失败", error));
}

/** 在 React 渲染前载入 JSON，并把旧版 localStorage 设置一次性迁移过去。 */
export async function initializeSettingsStore() {
  if (initialized) return;
  initialized = true;

  if (canInvokeTauri()) {
    try {
      const loaded = await invoke<SettingsObject>("load_app_settings");
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) settings = loaded;
    } catch (error) {
      console.error("读取设置失败，将使用默认设置", error);
    }
  }

  let migrated = false;
  if (typeof localStorage !== "undefined") {
    const legacyKeys = [
      "inknote.locale",
      "mdnote.theme",
      "mdnote.markdownTheme",
      "mdnote.customCss",
      "mdnote.lastFolder",
      "mdnote.lastFile",
      "mdnote.sidebarTab",
      "mdnote.recent",
      "mdnote.fontSize",
      "mdnote.lineHeight",
      "mdnote.editorWidthPreset",
      "mdnote.focusMaxWidth",
      "mdnote.defaultEditorMode",
      "mdnote.lineNumbers",
      "mdnote.wordWrap",
      "mdnote.tabSize",
      "mdnote.spellCheck",
      "mdnote.restoreLastFolder",
      "mdnote.restoreLastFile",
      "mdnote.fontFamily",
      "mdnote.monoFontFamily",
      "mdnote.editorZoom",
      "mdnote.sidebarVisible",
      "mdnote.sidebarWidth",
      "mdnote.defaultSidebarTab",
      "mdnote.confirmDiscard",
      "mdnote.confirmDelete",
      "mdnote.recentFilesLimit",
      "mdnote.showStatusBar",
      "mdnote.typewriterPadding",
    ];
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value !== null && readPath(pathFor(key)) === undefined) {
        writePath(pathFor(key), value);
        migrated = true;
      }
      localStorage.removeItem(key);
    }
  }
  if (migrated) persist();
}

export function getStoredValue(key: string): string | null {
  const value = readPath(pathFor(key));
  return value === undefined || value === null ? null : String(value);
}

export function setStoredValue(key: string, value: string) {
  writePath(pathFor(key), value);
  persist();
}

export function removeStoredValue(key: string) {
  removePath(pathFor(key));
  persist();
}

export function resetSettingsStoreForTests() {
  settings = {};
  initialized = false;
  saveChain = Promise.resolve();
}
