import type { EditorMode } from "../editor";
import type { SavedSidebarTab } from "./workspace";

export type DefaultEditorMode = EditorMode;

const KEYS = {
  fontSize: "mdnote.fontSize",
  lineHeight: "mdnote.lineHeight",
  editorMaxWidth: "mdnote.editorMaxWidth",
  focusMaxWidth: "mdnote.focusMaxWidth",
  autosave: "mdnote.autosave",
  autosaveDelay: "mdnote.autosaveDelay",
  defaultEditorMode: "mdnote.defaultEditorMode",
  lineNumbers: "mdnote.lineNumbers",
  wordWrap: "mdnote.wordWrap",
  tabSize: "mdnote.tabSize",
  spellCheck: "mdnote.spellCheck",
  restoreLastFolder: "mdnote.restoreLastFolder",
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

export function getAutosave(): boolean {
  return readBool(KEYS.autosave, true);
}

export function setAutosave(on: boolean) {
  writeBool(KEYS.autosave, on);
}

export function getAutosaveDelay(): number {
  return readNumber(KEYS.autosaveDelay, 500, 10000, 1200);
}

export function setAutosaveDelay(ms: number) {
  writeNumber(KEYS.autosaveDelay, ms);
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
}
