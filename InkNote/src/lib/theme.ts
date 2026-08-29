export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

import { getStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.theme";
const BOOTSTRAP_KEY = "inknote.bootstrapTheme";

function resolvePreference(preference: ThemePref): ResolvedTheme {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

/** Apply the last known theme before the settings IPC has completed. */
export function applyBootstrapTheme() {
  const cached = localStorage.getItem(BOOTSTRAP_KEY);
  const preference = cached === "light" || cached === "dark" || cached === "system"
    ? cached
    : "system";
  document.documentElement.setAttribute("data-theme", resolvePreference(preference));
}

export function getThemePref(): ThemePref {
  const v = getStoredValue(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function setThemePref(p: ThemePref) {
  setStoredValue(KEY, p);
  apply();
}

export function resolveTheme(): ResolvedTheme {
  return resolvePreference(getThemePref());
}

export function apply() {
  localStorage.setItem(BOOTSTRAP_KEY, getThemePref());
  document.documentElement.setAttribute("data-theme", resolveTheme());
  window.dispatchEvent(new Event("mdnote-visual-theme-changed"));
}
