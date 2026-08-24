export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

import { getStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.theme";

export function getThemePref(): ThemePref {
  const v = getStoredValue(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function setThemePref(p: ThemePref) {
  setStoredValue(KEY, p);
  apply();
}

export function resolveTheme(): ResolvedTheme {
  const p = getThemePref();
  if (p === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return p;
}

export function apply() {
  document.documentElement.setAttribute("data-theme", resolveTheme());
  window.dispatchEvent(new Event("mdnote-visual-theme-changed"));
}
