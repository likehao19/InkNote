import { isMac } from "./platform";

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
