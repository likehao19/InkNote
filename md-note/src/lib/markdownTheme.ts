export type MarkdownTheme = "github" | "vue" | "minimal";

import { getStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.markdownTheme";
const THEMES = new Set<MarkdownTheme>(["github", "vue", "minimal"]);
const LEGACY: Record<string, MarkdownTheme> = {
  ink: "github",
  paper: "vue",
  focus: "minimal",
};

export function getMarkdownTheme(): MarkdownTheme {
  const value = getStoredValue(KEY);
  if (value && THEMES.has(value as MarkdownTheme)) return value as MarkdownTheme;
  return (value && LEGACY[value]) || "github";
}

export function applyMarkdownTheme(theme = getMarkdownTheme()) {
  document.documentElement.setAttribute("data-md-theme", theme);
}

export function setMarkdownTheme(theme: MarkdownTheme) {
  setStoredValue(KEY, theme);
  applyMarkdownTheme(theme);
}
