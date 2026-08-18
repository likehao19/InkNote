import { isMac } from "./platform";

const mod = isMac ? "⌘" : "Ctrl";

export function modShortcut(key: string): string {
  return `${mod}+${key}`;
}

export function shortcut(key: string): string {
  return key;
}
