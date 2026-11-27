import { describe, expect, it, vi } from "vitest";
import { buildMenuGroups, type MenuCallbacks, type MenuState } from "./menus";
import { MARKDOWN_THEMES } from "../lib/markdownTheme";

function stubCallbacks(overrides: Partial<MenuCallbacks> = {}): MenuCallbacks {
  return {
    onNewFile: vi.fn(),
    onOpen: vi.fn(),
    onOpenFolder: vi.fn(),
    onCloseFile: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onExportHtml: vi.fn(),
    onExportPdf: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenAppearanceSettings: vi.fn(),
    onSelectMarkdownTheme: vi.fn(),
    onEditorAction: vi.fn(),
    onToggleSidebar: vi.fn(),
    onSidebarTab: vi.fn(),
    onSetEditorMode: vi.fn(),
    onToggleEditorMode: vi.fn(),
    onToggleFocus: vi.fn(),
    onToggleTypewriter: vi.fn(),
    onOpenShortcuts: vi.fn(),
    onCheckUpdates: vi.fn(),
    onOpenAbout: vi.fn(),
    ...overrides,
  };
}

function stubState(overrides: Partial<MenuState> = {}): MenuState {
  return {
    sidebarVisible: true,
    sidebarTab: "files",
    editorMode: "preview",
    focusMode: false,
    typewriterMode: false,
    recentFiles: [],
    documentEditable: true,
    pdfExportSupported: true,
    markdownTheme: "pixyll",
    ...overrides,
  };
}

describe("Theme top-level menu", () => {
  it("lists all built-in Markdown themes and marks the active theme as checked", () => {
    const onSelectMarkdownTheme = vi.fn();
    const groups = buildMenuGroups(
      stubCallbacks({ onSelectMarkdownTheme }),
      stubState({ markdownTheme: "pixyll" }),
      "zh",
    );

    const themeGroup = groups.find((group) => group.label === "主题");
    expect(themeGroup).toBeDefined();

    const leafItems = themeGroup!.items.filter((item) => !item.separator);
    expect(leafItems.length).toBe(MARKDOWN_THEMES.length + 1);

    const pixyllItem = leafItems.find((item) => item.label === "Pixyll");
    expect(pixyllItem?.checked).toBe(true);

    const newsprintItem = leafItems.find((item) => item.label === "Newsprint");
    expect(newsprintItem?.checked).toBe(false);
    newsprintItem?.action?.();
    expect(onSelectMarkdownTheme).toHaveBeenCalledWith("newsprint");
  });

  it("keeps theme switching enabled even when the active document is read-only", () => {
    const groups = buildMenuGroups(
      stubCallbacks(),
      stubState({ documentEditable: false, markdownTheme: "night" }),
      "en",
    );

    const themeGroup = groups.find((group) => group.label === "Theme");
    expect(themeGroup).toBeDefined();
    const items = themeGroup!.items.filter((item) => !item.separator);
    expect(items.every((item) => !item.disabled)).toBe(true);
    expect(items.find((item) => item.label === "Night")?.checked).toBe(true);
  });
});
