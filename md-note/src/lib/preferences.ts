import type { EditorMode } from "../editor";
import type { SavedSidebarTab } from "./workspace";

export type DefaultEditorMode = EditorMode;

const KEYS = {
  fontSize: "mdnote.fontSize",
  lineHeight: "mdnote.lineHeight",
  editorMaxWidth: "mdnote.editorMaxWidth",
  focusMaxWidth: "mdnote.focusMaxWidth",
  defaultEditorMode: "mdnote.defaultEditorMode",
  lineNumbers: "mdnote.lineNumbers",
  wordWrap: "mdnote.wordWrap",
  tabSize: "mdnote.tabSize",
  spellCheck: "mdnote.spellCheck",
  restoreLastFolder: "mdnote.restoreLastFolder",
  restoreLastFile: "mdnote.restoreLastFile",
  fontFamily: "mdnote.fontFamily",
  monoFontFamily: "mdnote.monoFontFamily",
  editorZoom: "mdnote.editorZoom",
  sidebarVisible: "mdnote.sidebarVisible",
  sidebarWidth: "mdnote.sidebarWidth",
  defaultSidebarTab: "mdnote.defaultSidebarTab",
  confirmDiscard: "mdnote.confirmDiscard",
  confirmDelete: "mdnote.confirmDelete",
  recentFilesLimit: "mdnote.recentFilesLimit",
  showStatusBar: "mdnote.showStatusBar",
  typewriterPadding: "mdnote.typewriterPadding",
} as const;

function readBool(key: string, defaultOn = true): boolean {
  const v = localStorage.getItem(key);
  if (v === "on") return true;
  if (v === "off") return false;
  return defaultOn;
}

function writeBool(key: string, on: boolean) {
  localStorage.setItem(key, on ? "on" : "off");
}

function readNumber(key: string, min: number, max: number, fallback: number): number {
  const n = Number(localStorage.getItem(key));
  return n >= min && n <= max ? n : fallback;
}

function writeNumber(key: string, n: number) {
  localStorage.setItem(key, String(n));
}

export function getFontSize(): number {
  return readNumber(KEYS.fontSize, 12, 28, 15);
}

export function setFontSize(n: number) {
  writeNumber(KEYS.fontSize, n);
}

export function getLineHeight(): number {
  return readNumber(KEYS.lineHeight, 1.4, 2.4, 1.75);
}

export function setLineHeight(n: number) {
  writeNumber(KEYS.lineHeight, n);
}

export function getEditorMaxWidth(): number {
  return readNumber(KEYS.editorMaxWidth, 32, 80, 46);
}

export function setEditorMaxWidth(n: number) {
  writeNumber(KEYS.editorMaxWidth, n);
}

export function getFocusMaxWidth(): number {
  return readNumber(KEYS.focusMaxWidth, 28, 60, 40);
}

export function setFocusMaxWidth(n: number) {
  writeNumber(KEYS.focusMaxWidth, n);
}

export function getDefaultEditorMode(): DefaultEditorMode {
  const v = localStorage.getItem(KEYS.defaultEditorMode);
  return v === "source" ? "source" : "preview";
}

export function setDefaultEditorMode(mode: DefaultEditorMode) {
  localStorage.setItem(KEYS.defaultEditorMode, mode);
}

export function getLineNumbers(): boolean {
  return localStorage.getItem(KEYS.lineNumbers) === "on";
}

export function setLineNumbers(on: boolean) {
  writeBool(KEYS.lineNumbers, on);
}

export function getWordWrap(): boolean {
  return readBool(KEYS.wordWrap, true);
}

export function setWordWrap(on: boolean) {
  writeBool(KEYS.wordWrap, on);
}

export function getTabSize(): number {
  return readNumber(KEYS.tabSize, 2, 8, 2);
}

export function setTabSize(n: number) {
  writeNumber(KEYS.tabSize, n);
}

export function getSpellCheck(): boolean {
  return localStorage.getItem(KEYS.spellCheck) === "on";
}

export function setSpellCheck(on: boolean) {
  writeBool(KEYS.spellCheck, on);
}

export function getRestoreLastFolder(): boolean {
  return readBool(KEYS.restoreLastFolder, true);
}

export function setRestoreLastFolder(on: boolean) {
  writeBool(KEYS.restoreLastFolder, on);
}

export function getRestoreLastFile(): boolean {
  return readBool(KEYS.restoreLastFile, true);
}

export function setRestoreLastFile(on: boolean) {
  writeBool(KEYS.restoreLastFile, on);
}

const FONT_STACKS: Record<string, string> = {
  system: "system-ui, -apple-system, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif",
  serif: "Georgia, Cambria, Times New Roman, serif",
};

export function getFontFamily(): string {
  const v = localStorage.getItem(KEYS.fontFamily);
  return v && FONT_STACKS[v] ? v : "system";
}

export function setFontFamily(key: string) {
  localStorage.setItem(KEYS.fontFamily, key);
}

export function getMonoFontFamily(): string {
  return localStorage.getItem(KEYS.monoFontFamily) === "jetbrains" ? "jetbrains" : "system";
}

export function setMonoFontFamily(key: string) {
  localStorage.setItem(KEYS.monoFontFamily, key);
}

export function resolveFontFamily(): string {
  return FONT_STACKS[getFontFamily()] ?? FONT_STACKS.system;
}

export function resolveMonoFontFamily(): string {
  return getMonoFontFamily() === "jetbrains"
    ? "JetBrains Mono, ui-monospace, Consolas, monospace"
    : "ui-monospace, Cascadia Code, Consolas, monospace";
}

export function getEditorZoom(): number {
  return readNumber(KEYS.editorZoom, 80, 150, 100);
}

export function setEditorZoom(n: number) {
  writeNumber(KEYS.editorZoom, n);
}

export function getSidebarVisiblePref(): boolean {
  return readBool(KEYS.sidebarVisible, true);
}

export function setSidebarVisiblePref(on: boolean) {
  writeBool(KEYS.sidebarVisible, on);
}

export const SIDEBAR_WIDTH_MIN = 180;
export const SIDEBAR_WIDTH_MAX = 520;
export const SIDEBAR_WIDTH_DEFAULT = 248;
export const SIDEBAR_COLLAPSE_WIDTH = 140;

export function getSidebarWidth(): number {
  return readNumber(KEYS.sidebarWidth, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT);
}

export function setSidebarWidth(n: number) {
  writeNumber(
    KEYS.sidebarWidth,
    Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, n)),
  );
}

export function getDefaultSidebarTab(): SavedSidebarTab {
  const v = localStorage.getItem(KEYS.defaultSidebarTab);
  return v === "outline" || v === "recent" ? v : "files";
}

export function setDefaultSidebarTab(tab: SavedSidebarTab) {
  localStorage.setItem(KEYS.defaultSidebarTab, tab);
}

export function getConfirmDiscard(): boolean {
  return readBool(KEYS.confirmDiscard, true);
}

export function setConfirmDiscard(on: boolean) {
  writeBool(KEYS.confirmDiscard, on);
}

export function getConfirmDelete(): boolean {
  return readBool(KEYS.confirmDelete, true);
}

export function setConfirmDelete(on: boolean) {
  writeBool(KEYS.confirmDelete, on);
}

export function getRecentFilesLimit(): number {
  return readNumber(KEYS.recentFilesLimit, 5, 30, 12);
}

export function setRecentFilesLimit(n: number) {
  writeNumber(KEYS.recentFilesLimit, n);
}

export function getShowStatusBar(): boolean {
  return readBool(KEYS.showStatusBar, true);
}

export function setShowStatusBar(on: boolean) {
  writeBool(KEYS.showStatusBar, on);
}

export function getTypewriterPadding(): number {
  return readNumber(KEYS.typewriterPadding, 20, 50, 40);
}

export function setTypewriterPadding(vh: number) {
  writeNumber(KEYS.typewriterPadding, vh);
}

/** 将偏好写入 CSS 变量，供全局样式使用 */
export function applyEditorLayoutPrefs() {
  const root = document.documentElement;
  root.style.setProperty("--editor-font-size", `${getFontSize()}px`);
  root.style.setProperty("--editor-line-height", String(getLineHeight()));
  root.style.setProperty("--editor-max-width", `${getEditorMaxWidth()}rem`);
  root.style.setProperty("--editor-focus-max-width", `${getFocusMaxWidth()}rem`);
  root.style.setProperty("--typewriter-padding", `${getTypewriterPadding()}vh`);
  root.style.setProperty("--editor-font-family", resolveFontFamily());
  root.style.setProperty("--editor-mono-font", resolveMonoFontFamily());
  root.style.setProperty("--editor-zoom", String(getEditorZoom() / 100));
}
