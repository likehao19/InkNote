import { isMac } from "./platform";
import { getStoredValue, setStoredValue } from "./settingsStore";

const STORAGE_KEY = "mdnote.shortcuts";

export const APP_SHORTCUT_ACTIONS = [
  "new", "open", "save", "saveAs", "closeFile", "reopenClosed",
  "quickOpen", "settings", "find", "findReplace", "globalSearch",
  "toggleSidebar", "toggleMode", "focusMode", "typewriterMode",
  "fullscreen", "zoomIn", "zoomOut",
] as const;

export type AppShortcutAction = typeof APP_SHORTCUT_ACTIONS[number];
export type ShortcutMap = Record<AppShortcutAction, string>;

const DEFAULT_SHORTCUTS: ShortcutMap = {
  new: "Mod+N",
  open: "Mod+O",
  save: "Mod+S",
  saveAs: "Mod+Shift+S",
  closeFile: "Mod+W",
  reopenClosed: "Mod+Shift+T",
  quickOpen: "Mod+P",
  settings: "Mod+,",
  find: "Mod+F",
  findReplace: isMac ? "Mod+Alt+F" : "Mod+H",
  globalSearch: "Mod+Shift+F",
  toggleSidebar: "Mod+Shift+L",
  toggleMode: "Mod+/",
  focusMode: "F8",
  typewriterMode: "F9",
  fullscreen: isMac ? "Ctrl+Mod+F" : "F11",
  zoomIn: "Mod+=",
  zoomOut: "Mod+-",
};

const KEY_ALIASES: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

const CODE_KEYS: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
};

export function getDefaultShortcutMap(): ShortcutMap {
  return { ...DEFAULT_SHORTCUTS };
}

export function getShortcutMap(): ShortcutMap {
  const raw = getStoredValue(STORAGE_KEY);
  if (!raw) return getDefaultShortcutMap();
  try {
    const stored = JSON.parse(raw) as Partial<Record<AppShortcutAction, unknown>>;
    return Object.fromEntries(APP_SHORTCUT_ACTIONS.map((action) => [
      action,
      typeof stored[action] === "string" && isValidAppShortcut(stored[action])
        ? stored[action]
        : DEFAULT_SHORTCUTS[action],
    ])) as ShortcutMap;
  } catch {
    return getDefaultShortcutMap();
  }
}

export function setShortcutMap(value: ShortcutMap): void {
  setStoredValue(STORAGE_KEY, JSON.stringify(value));
}

export function eventToShortcut(event: KeyboardEvent): string | null {
  const rawKey = KEY_ALIASES[event.key] ?? event.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(rawKey)) return null;
  const codeKey = event.code.startsWith("Key")
    ? event.code.slice(3)
    : event.code.startsWith("Digit")
      ? event.code.slice(5)
      : CODE_KEYS[event.code];
  const key = codeKey ?? (rawKey.length === 1 ? rawKey.toUpperCase() : rawKey);
  const modifiers: string[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) modifiers.push("Mod");
  if (isMac ? event.ctrlKey : event.metaKey) modifiers.push(isMac ? "Ctrl" : "Meta");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey && !(event.code === "Equal" && rawKey === "+")) modifiers.push("Shift");
  return [...modifiers, key === "+" ? "=" : key].join("+");
}

export function isValidAppShortcut(shortcut: string | null): shortcut is string {
  if (!shortcut) return false;
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1];
  return parts.slice(0, -1).some((part) => part !== "Shift")
    || /^F(?:[1-9]|1[0-2])$/.test(key);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  return eventToShortcut(event) === shortcut;
}

export function shortcutConflict(
  shortcuts: ShortcutMap,
  action: AppShortcutAction,
  shortcut: string,
): AppShortcutAction | null {
  return APP_SHORTCUT_ACTIONS.find((candidate) => (
    candidate !== action && shortcuts[candidate] === shortcut
  )) ?? null;
}

export function formatShortcut(value: string): string {
  const labels: Record<string, string> = isMac
    ? { Mod: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" }
    : { Mod: "Ctrl", Meta: "Win", Alt: "Alt", Shift: "Shift" };
  return value.split("+").map((part) => labels[part] ?? part).join(isMac ? "" : "+");
}

export function toTauriAccelerator(value: string): string {
  return value
    .split("+")
    .map((part) => part === "Mod" ? "CmdOrCtrl" : part === "Meta" ? "Super" : part)
    .join("+");
}

const mod = isMac ? "⌘" : "Ctrl";

export function modShortcut(key: string): string {
  return `${mod}+${key}`;
}

export function shortcut(key: string): string {
  return key;
}

export function altShortcut(key: string): string {
  return isMac ? `⌥+${key}` : `Alt+${key}`;
}

export function redoShortcut(): string {
  return isMac ? modShortcut("Shift+Z") : `${modShortcut("Y")} / ${modShortcut("Shift+Z")}`;
}

export function deleteShortcut(): string {
  return isMac ? "⌫" : "Delete";
}

export function fullscreenShortcut(): string {
  return isMac ? "⌃+⌘+F" : "F11";
}

export function findReplaceShortcut(): string {
  return isMac ? "⌘+⌥+F" : modShortcut("H");
}
