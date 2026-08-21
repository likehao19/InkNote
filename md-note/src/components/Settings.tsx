import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemePref } from "../lib/theme";
import type { Locale, MessageKey } from "../lib/i18n";
import { t } from "../lib/i18n";
import type { DefaultEditorMode, EditorWidthPreset } from "../lib/preferences";
import type { MarkdownTheme } from "../lib/markdownTheme";
import type { SavedSidebarTab } from "../lib/workspace";
import { isMac } from "../lib/tauri";
import * as api from "../lib/tauri";
import { getCustomCssPath, setCustomCssPath } from "../lib/customTheme";
import ThemePicker from "./ThemePicker";
import MarkdownThemePicker from "./MarkdownThemePicker";

export type SettingsCategory =
  | "general"
  | "workspace"
  | "editor"
  | "appearance"
  | "document"
  | "about";

const CATEGORIES: SettingsCategory[] = [
  "general",
  "workspace",
  "editor",
  "appearance",
  "document",
  "about",
];

const CATEGORY_KEYS: Record<SettingsCategory, MessageKey> = {
  general: "settings.category.general",
  workspace: "settings.category.workspace",
  editor: "settings.category.editor",
  appearance: "settings.category.appearance",
  document: "settings.category.document",
  about: "settings.category.about",
};

export interface SettingsValues {
  locale: Locale;
  theme: ThemePref;
  markdownTheme: MarkdownTheme;
  restoreLastFolder: boolean;
  restoreLastFile: boolean;
  confirmDiscard: boolean;
  confirmDelete: boolean;
  recentFilesLimit: number;
  sidebarVisible: boolean;
  defaultSidebarTab: SavedSidebarTab;
  defaultEditorMode: DefaultEditorMode;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  monoFontFamily: string;
  editorZoom: number;
  editorWidthPreset: EditorWidthPreset;
  focusMaxWidth: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  spellCheck: boolean;
  typewriterPadding: number;
  showStatusBar: boolean;
  frontMatter: Record<string, string>;
}

export interface SettingsHandlers {
  onLocale: (locale: Locale) => void;
  onTheme: (theme: ThemePref) => void;
  onMarkdownTheme: (theme: MarkdownTheme) => void;
  onRestoreLastFolder: (on: boolean) => void;
  onRestoreLastFile: (on: boolean) => void;
  onConfirmDiscard: (on: boolean) => void;
  onConfirmDelete: (on: boolean) => void;
  onRecentFilesLimit: (n: number) => void;
  onClearRecent: () => void;
  onSidebarVisible: (on: boolean) => void;
  onDefaultSidebarTab: (tab: SavedSidebarTab) => void;
  onDefaultEditorMode: (mode: DefaultEditorMode) => void;
  onFontSize: (n: number) => void;
  onLineHeight: (n: number) => void;
  onFontFamily: (key: string) => void;
  onMonoFontFamily: (key: string) => void;
  onEditorZoom: (n: number) => void;
  onEditorWidthPreset: (preset: EditorWidthPreset) => void;
  onFocusMaxWidth: (n: number) => void;
  onLineNumbers: (on: boolean) => void;
  onWordWrap: (on: boolean) => void;
  onTabSize: (n: number) => void;
  onSpellCheck: (on: boolean) => void;
  onTypewriterPadding: (vh: number) => void;
  onShowStatusBar: (on: boolean) => void;
  onFrontMatter: (data: Record<string, string>) => void;
}

interface Props {
  values: SettingsValues;
  handlers: SettingsHandlers;
  onClose: () => void;
}

function buildSearchIndex(): { category: SettingsCategory; keys: MessageKey[] }[] {
  return [
    {
      category: "general",
      keys: [
        "settings.language", "settings.languageDesc",
        "settings.restoreLastFolder", "settings.restoreLastFolderDesc",
        "settings.restoreLastFile", "settings.restoreLastFileDesc",
        "settings.confirmDiscard", "settings.confirmDiscardDesc",
        "settings.confirmDelete", "settings.confirmDeleteDesc",
        "settings.recentFilesLimit", "settings.recentFilesLimitDesc",
        "settings.clearRecent", "settings.clearRecentDesc",
      ],
    },
    {
      category: "workspace",
      keys: [
        "settings.sidebarVisible", "settings.sidebarVisibleDesc",
        "settings.defaultSidebarTab", "settings.defaultSidebarTabDesc",
      ],
    },
    {
      category: "editor",
      keys: [
        "settings.defaultMode", "settings.defaultModeDesc",
        "settings.fontSize", "settings.fontSizeDesc",
        "settings.lineHeight", "settings.lineHeightDesc",
        "settings.fontFamily", "settings.monoFontFamily",
        "settings.editorZoom", "settings.editorZoomDesc",
        "settings.editorMaxWidth", "settings.editorMaxWidthDesc",
        "settings.focusMaxWidth", "settings.focusMaxWidthDesc",
        "settings.lineNumbers", "settings.lineNumbersDesc",
        "settings.wordWrap", "settings.wordWrapDesc",
        "settings.tabSize", "settings.tabSizeDesc",
        "settings.spellCheck", "settings.spellCheckDesc",
        "settings.typewriterPadding", "settings.typewriterPaddingDesc",
      ],
    },
    {
      category: "appearance",
      keys: [
        "settings.theme", "settings.themeDesc",
        "settings.markdownTheme", "settings.markdownThemeDesc",
        "settings.customCss", "settings.customCssDesc",
        "settings.showStatusBar", "settings.showStatusBarDesc",
      ],
    },
    {
      category: "document",
      keys: [
        "settings.yamlTitle", "settings.yamlAuthor", "settings.yamlDate", "settings.yamlDesc",
      ],
    },
    {
      category: "about",
      keys: [
        "settings.defaultApp", "settings.defaultAppMac", "settings.defaultAppWin", "settings.aboutText",
      ],
    },
  ];
}

const SEARCH_INDEX = buildSearchIndex();

export default function Settings({ values, handlers, onClose }: Props) {
  const { locale, frontMatter, ...rest } = values;
  const [category, setCategory] = useState<SettingsCategory>("general");
  const [query, setQuery] = useState("");
  const [cssTick, setCssTick] = useState(0);
  const customCss = getCustomCssPath();
  void cssTick;
  void rest;

  const tr = (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars);

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter((cat) =>
      SEARCH_INDEX.find((item) => item.category === cat)?.keys.some((key) =>
        tr(key).toLowerCase().includes(q),
      ),
    );
  }, [query, locale]);

  const activeCategory = visibleCategories.includes(category)
    ? category
    : visibleCategories[0] ?? "general";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickCss = async () => {
    const p = await api.openCssDialog();
    if (p) {
      setCustomCssPath(p);
      setCssTick((n) => n + 1);
    }
  };

  const clearCss = () => {
    setCustomCssPath(null);
    setCssTick((n) => n + 1);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={tr("settings.title")}
      >
        <div className="settings-toolbar">
          <div className="settings-search-wrap">
            <svg className="settings-search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              className="settings-search"
              type="search"
              placeholder={tr("settings.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label={tr("dialog.close")}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={activeCategory === cat ? "settings-nav-item active" : "settings-nav-item"}
                onClick={() => setCategory(cat)}
              >
                {tr(CATEGORY_KEYS[cat])}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {visibleCategories.length === 0 ? (
              <div className="settings-empty">{tr("settings.noResults")}</div>
            ) : (
              <>
                {activeCategory === "general" && (
                  <SettingsPage title={tr("settings.section.general")}>
                    <SettingItem label={tr("settings.language")} desc={tr("settings.languageDesc")}>
                      <select value={locale} onChange={(e) => handlers.onLocale(e.target.value as Locale)}>
                        <option value="zh">{tr("settings.language.zh")}</option>
                        <option value="en">{tr("settings.language.en")}</option>
                      </select>
                    </SettingItem>
                    <SettingItem label={tr("settings.restoreLastFolder")} desc={tr("settings.restoreLastFolderDesc")}>
                      <Toggle checked={values.restoreLastFolder} onChange={handlers.onRestoreLastFolder} />
                    </SettingItem>
                    <SettingItem label={tr("settings.restoreLastFile")} desc={tr("settings.restoreLastFileDesc")}>
                      <Toggle checked={values.restoreLastFile} onChange={handlers.onRestoreLastFile} />
                    </SettingItem>
                    <SettingItem label={tr("settings.confirmDiscard")} desc={tr("settings.confirmDiscardDesc")}>
                      <Toggle checked={values.confirmDiscard} onChange={handlers.onConfirmDiscard} />
                    </SettingItem>
                    <SettingItem label={tr("settings.confirmDelete")} desc={tr("settings.confirmDeleteDesc")}>
                      <Toggle checked={values.confirmDelete} onChange={handlers.onConfirmDelete} />
                    </SettingItem>
                    <SettingItem label={tr("settings.recentFilesLimit")} desc={tr("settings.recentFilesLimitDesc")}>
                      <NumberInput
                        min={5}
                        max={30}
                        step={1}
                        value={values.recentFilesLimit}
                        onChange={handlers.onRecentFilesLimit}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.clearRecent")} desc={tr("settings.clearRecentDesc")}>
                      <button type="button" className="settings-text-btn" onClick={handlers.onClearRecent}>
                        {tr("settings.clearRecentBtn")}
                      </button>
                    </SettingItem>
                  </SettingsPage>
                )}

                {activeCategory === "workspace" && (
                  <SettingsPage title={tr("settings.section.workspace")}>
                    <SettingItem label={tr("settings.sidebarVisible")} desc={tr("settings.sidebarVisibleDesc")}>
                      <Toggle checked={values.sidebarVisible} onChange={handlers.onSidebarVisible} />
                    </SettingItem>
                    <SettingItem label={tr("settings.defaultSidebarTab")} desc={tr("settings.defaultSidebarTabDesc")}>
                      <select
                        value={values.defaultSidebarTab}
                        onChange={(e) => handlers.onDefaultSidebarTab(e.target.value as SavedSidebarTab)}
                      >
                        <option value="files">{tr("settings.sidebarTab.files")}</option>
                        <option value="outline">{tr("settings.sidebarTab.outline")}</option>
                        <option value="recent">{tr("settings.sidebarTab.recent")}</option>
                      </select>
                    </SettingItem>
                  </SettingsPage>
                )}

                {activeCategory === "editor" && (
                  <SettingsPage title={tr("settings.section.editor")}>
                    <SettingItem label={tr("settings.defaultMode")} desc={tr("settings.defaultModeDesc")}>
                      <select
                        value={values.defaultEditorMode}
                        onChange={(e) => handlers.onDefaultEditorMode(e.target.value as DefaultEditorMode)}
                      >
                        <option value="preview">{tr("settings.mode.preview")}</option>
                        <option value="source">{tr("settings.mode.source")}</option>
                      </select>
                    </SettingItem>
                    <SettingItem label={tr("settings.fontSize")} desc={tr("settings.fontSizeDesc")}>
                      <NumberInput min={12} max={28} step={1} value={values.fontSize} onChange={handlers.onFontSize} />
                    </SettingItem>
                    <SettingItem label={tr("settings.lineHeight")} desc={tr("settings.lineHeightDesc")}>
                      <NumberInput
                        min={1.4}
                        max={2.4}
                        step={0.05}
                        value={values.lineHeight}
                        onChange={handlers.onLineHeight}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.fontFamily")}>
                      <select value={values.fontFamily} onChange={(e) => handlers.onFontFamily(e.target.value)}>
                        <option value="system">{tr("settings.fontFamily.system")}</option>
                        <option value="serif">{tr("settings.fontFamily.serif")}</option>
                      </select>
                    </SettingItem>
                    <SettingItem label={tr("settings.monoFontFamily")}>
                      <select value={values.monoFontFamily} onChange={(e) => handlers.onMonoFontFamily(e.target.value)}>
                        <option value="system">{tr("settings.monoFontFamily.system")}</option>
                        <option value="jetbrains">{tr("settings.monoFontFamily.jetbrains")}</option>
                      </select>
                    </SettingItem>
                    <SettingItem label={tr("settings.editorZoom")} desc={tr("settings.editorZoomDesc")}>
                      <NumberInput
                        min={80}
                        max={150}
                        step={10}
                        value={values.editorZoom}
                        onChange={handlers.onEditorZoom}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.editorMaxWidth")} desc={tr("settings.editorMaxWidthDesc")}>
                      <select
                        value={values.editorWidthPreset}
                        onChange={(e) => handlers.onEditorWidthPreset(e.target.value as EditorWidthPreset)}
                      >
                        <option value="compact">{tr("settings.editorWidth.compact")}</option>
                        <option value="standard">{tr("settings.editorWidth.standard")}</option>
                        <option value="wide">{tr("settings.editorWidth.wide")}</option>
                        <option value="full">{tr("settings.editorWidth.full")}</option>
                      </select>
                    </SettingItem>
                    <SettingItem label={tr("settings.focusMaxWidth")} desc={tr("settings.focusMaxWidthDesc")}>
                      <NumberInput
                        min={28}
                        max={60}
                        step={1}
                        value={values.focusMaxWidth}
                        onChange={handlers.onFocusMaxWidth}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.lineNumbers")} desc={tr("settings.lineNumbersDesc")}>
                      <Toggle checked={values.lineNumbers} onChange={handlers.onLineNumbers} />
                    </SettingItem>
                    <SettingItem label={tr("settings.wordWrap")} desc={tr("settings.wordWrapDesc")}>
                      <Toggle checked={values.wordWrap} onChange={handlers.onWordWrap} />
                    </SettingItem>
                    <SettingItem label={tr("settings.tabSize")} desc={tr("settings.tabSizeDesc")}>
                      <NumberInput min={2} max={8} step={1} value={values.tabSize} onChange={handlers.onTabSize} />
                    </SettingItem>
                    <SettingItem label={tr("settings.spellCheck")} desc={tr("settings.spellCheckDesc")}>
                      <Toggle checked={values.spellCheck} onChange={handlers.onSpellCheck} />
                    </SettingItem>
                    <SettingItem label={tr("settings.typewriterPadding")} desc={tr("settings.typewriterPaddingDesc")}>
                      <NumberInput
                        min={20}
                        max={50}
                        step={1}
                        value={values.typewriterPadding}
                        onChange={handlers.onTypewriterPadding}
                      />
                    </SettingItem>
                  </SettingsPage>
                )}

                {activeCategory === "appearance" && (
                  <SettingsPage title={tr("settings.section.appearance")}>
                    <SettingItem label={tr("settings.theme")} desc={tr("settings.themeDesc")}>
                      <ThemePicker locale={locale} value={values.theme} onChange={handlers.onTheme} />
                    </SettingItem>
                    <SettingItem
                      label={tr("settings.markdownTheme")}
                      desc={tr("settings.markdownThemeDesc")}
                    >
                      <MarkdownThemePicker
                        locale={locale}
                        value={values.markdownTheme}
                        onChange={handlers.onMarkdownTheme}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.showStatusBar")} desc={tr("settings.showStatusBarDesc")}>
                      <Toggle checked={values.showStatusBar} onChange={handlers.onShowStatusBar} />
                    </SettingItem>
                    <SettingItem label={tr("settings.customCss")} desc={tr("settings.customCssDesc")}>
                      <div className="settings-inline-actions">
                        <button type="button" className="settings-text-btn" onClick={pickCss}>
                          {tr("settings.pickCss")}
                        </button>
                        {customCss && (
                          <button type="button" className="settings-text-btn" onClick={clearCss}>
                            {tr("settings.clearCss")}
                          </button>
                        )}
                        {customCss && (
                          <span className="settings-file-name" title={customCss}>
                            {customCss.split(/[\\/]/).pop()}
                          </span>
                        )}
                      </div>
                    </SettingItem>
                  </SettingsPage>
                )}

                {activeCategory === "document" && (
                  <SettingsPage title={tr("settings.section.document")}>
                    <p className="settings-page-desc">{tr("settings.yamlDesc")}</p>
                    <SettingItem label={tr("settings.yamlTitle")}>
                      <input
                        type="text"
                        className="settings-text"
                        value={frontMatter.title ?? ""}
                        onChange={(e) => handlers.onFrontMatter({ ...frontMatter, title: e.target.value })}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.yamlAuthor")}>
                      <input
                        type="text"
                        className="settings-text"
                        value={frontMatter.author ?? ""}
                        onChange={(e) => handlers.onFrontMatter({ ...frontMatter, author: e.target.value })}
                      />
                    </SettingItem>
                    <SettingItem label={tr("settings.yamlDate")}>
                      <input
                        type="text"
                        className="settings-text"
                        value={frontMatter.date ?? ""}
                        onChange={(e) => handlers.onFrontMatter({ ...frontMatter, date: e.target.value })}
                      />
                    </SettingItem>
                  </SettingsPage>
                )}

                {activeCategory === "about" && (
                  <SettingsPage title={tr("settings.section.about")}>
                    <p className="settings-page-desc">{tr("settings.aboutText")}</p>
                    <SettingItem label={tr("settings.version")}>
                      <span className="settings-muted">0.1.0</span>
                    </SettingItem>
                    <SettingItem label={tr("settings.defaultApp")}>
                      <p className="settings-hint-block">
                        {isMac ? tr("settings.defaultAppMac") : tr("settings.defaultAppWin")}
                      </p>
                    </SettingItem>
                  </SettingsPage>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-page">
      <h2 className="settings-page-title">{title}</h2>
      <div className="settings-page-body">{children}</div>
    </section>
  );
}

function SettingItem({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-item">
      <div className="settings-item-info">
        <div className="settings-item-label">{label}</div>
        {desc && <div className="settings-item-desc">{desc}</div>}
      </div>
      <div className="settings-item-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? "settings-toggle is-on" : "settings-toggle"}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function NumberInput({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      className="settings-number"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (n >= min && n <= max) onChange(n);
      }}
    />
  );
}
