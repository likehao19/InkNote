import { getStoredValue, setStoredValue } from "./settingsStore";

export type MarkdownTheme =
  | "pixyll"
  | "github"
  | "newsprint"
  | "whitey"
  | "night"
  | "lapis"
  | "sepia"
  | "nord"
  | "academic"
  | "vue"
  | "minimal";

export type MarkdownThemeGroup = "typora" | "curated" | "classic";

export interface MarkdownThemeMeta {
  id: MarkdownTheme;
  group: MarkdownThemeGroup;
  typography: "editorial" | "serif" | "sans";
}

export const MARKDOWN_THEMES: readonly MarkdownThemeMeta[] = [
  { id: "pixyll", group: "typora", typography: "editorial" },
  { id: "github", group: "typora", typography: "sans" },
  { id: "newsprint", group: "typora", typography: "serif" },
  { id: "whitey", group: "typora", typography: "sans" },
  { id: "night", group: "typora", typography: "sans" },
  { id: "lapis", group: "curated", typography: "sans" },
  { id: "sepia", group: "curated", typography: "serif" },
  { id: "nord", group: "curated", typography: "sans" },
  { id: "academic", group: "curated", typography: "serif" },
  { id: "vue", group: "classic", typography: "sans" },
  { id: "minimal", group: "classic", typography: "sans" },
];

const KEY = "mdnote.markdownTheme";
const THEMES = new Set<MarkdownTheme>(MARKDOWN_THEMES.map((item) => item.id));
const LEGACY: Record<string, MarkdownTheme> = {
  ink: "github",
  paper: "vue",
  focus: "minimal",
};

export function isMarkdownTheme(value: string): value is MarkdownTheme {
  return THEMES.has(value as MarkdownTheme);
}

export function getMarkdownTheme(): MarkdownTheme {
  const value = getStoredValue(KEY);
  if (value && isMarkdownTheme(value)) return value;
  return (value && LEGACY[value]) || "github";
}

export function applyMarkdownTheme(theme = getMarkdownTheme()) {
  document.documentElement.setAttribute("data-md-theme", theme);
}

export function setMarkdownTheme(theme: MarkdownTheme) {
  setStoredValue(KEY, theme);
  applyMarkdownTheme(theme);
}
