import type { EditorAction } from "../editor";
import { modShortcut, redoShortcut, shortcut } from "../lib/shortcuts";
import { basename } from "../lib/paths";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import type { MenuGroupDef } from "./MenuBar";
import type { SidebarTab } from "./Sidebar";
import type { EditorMode } from "../editor";

export interface MenuCallbacks {
  onNewFile: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onCloseFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onOpenSettings: () => void;
  onEditorAction: (action: EditorAction) => void;
  onToggleSidebar: () => void;
  onSidebarTab: (tab: SidebarTab) => void;
  onSetEditorMode: (mode: EditorMode) => void;
  onToggleEditorMode: () => void;
  onToggleFocus: () => void;
  onToggleTypewriter: () => void;
  onOpenShortcuts: () => void;
  onCheckUpdates: () => void;
  onOpenAbout: () => void;
  onGlobalSearch?: () => void;
  onQuickOpen?: () => void;
  onOpenRecent?: (path: string) => void;
  onReopenClosed?: () => void;
}

export interface MenuState {
  sidebarVisible: boolean;
  sidebarTab: SidebarTab;
  editorMode: EditorMode;
  focusMode: boolean;
  typewriterMode: boolean;
  recentFiles: string[];
  canReopenClosed?: boolean;
  documentEditable: boolean;
}

export function buildMenuGroups(
  cb: MenuCallbacks,
  state: MenuState,
  locale: Locale,
): MenuGroupDef[] {
  const { onEditorAction: run } = cb;
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  const groups: MenuGroupDef[] = [
    {
      label: tr("menu.file"),
      items: [
        { label: tr("menu.new"), shortcut: modShortcut("N"), action: cb.onNewFile },
        { label: tr("menu.open"), shortcut: modShortcut("O"), action: cb.onOpen },
        { label: tr("menu.openFolder"), action: cb.onOpenFolder },
        ...(state.recentFiles.length > 0 && cb.onOpenRecent
          ? [
              {
                label: tr("menu.openRecent"),
                children: state.recentFiles.slice(0, 10).map((path) => ({
                  label: basename(path),
                  title: path,
                  action: () => cb.onOpenRecent!(path),
                })),
              },
            ]
          : []),
        { separator: true, label: "" },
        { label: tr("menu.close"), shortcut: modShortcut("W"), action: cb.onCloseFile },
        ...(cb.onReopenClosed && state.canReopenClosed
          ? [{ label: tr("menu.reopenClosed"), shortcut: modShortcut("Shift+T"), action: cb.onReopenClosed }]
          : []),
        { separator: true, label: "" },
        { label: tr("menu.save"), shortcut: modShortcut("S"), action: cb.onSave },
        { label: tr("menu.saveAs"), shortcut: modShortcut("Shift+S"), action: cb.onSaveAs },
        ...(cb.onQuickOpen
          ? [{ label: tr("menu.quickOpen"), shortcut: modShortcut("P"), action: cb.onQuickOpen }]
          : []),
        { separator: true, label: "" },
        { label: tr("menu.exportHtml"), action: cb.onExportHtml },
        { label: tr("menu.exportPdf"), action: cb.onExportPdf },
        { separator: true, label: "" },
        { label: tr("menu.settings"), shortcut: modShortcut(","), action: cb.onOpenSettings },
      ],
    },
    {
      label: tr("menu.edit"),
      items: [
        { label: tr("menu.undo"), shortcut: modShortcut("Z"), action: () => run("undo") },
        { label: tr("menu.redo"), shortcut: redoShortcut(), action: () => run("redo") },
        { separator: true, label: "" },
        { label: tr("menu.cut"), shortcut: modShortcut("X"), action: () => run("cut") },
        { label: tr("menu.copy"), shortcut: modShortcut("C"), action: () => run("copy") },
        { label: tr("menu.paste"), shortcut: modShortcut("V"), action: () => run("paste") },
        { label: tr("menu.selectAll"), shortcut: modShortcut("A"), action: () => run("selectAll") },
        { separator: true, label: "" },
        { label: tr("menu.find"), shortcut: modShortcut("F"), action: () => run("find") },
        { label: tr("menu.findReplace"), shortcut: modShortcut("H"), action: () => run("findReplace") },
      ],
    },
    {
      label: tr("menu.paragraph"),
      items: [
        { label: tr("menu.heading1"), shortcut: modShortcut("1"), action: () => run("heading1") },
        { label: tr("menu.heading2"), shortcut: modShortcut("2"), action: () => run("heading2") },
        { label: tr("menu.heading3"), shortcut: modShortcut("3"), action: () => run("heading3") },
        { label: tr("menu.heading4"), shortcut: modShortcut("4"), action: () => run("heading4") },
        { label: tr("menu.heading5"), shortcut: modShortcut("5"), action: () => run("heading5") },
        { label: tr("menu.heading6"), shortcut: modShortcut("6"), action: () => run("heading6") },
        { label: tr("menu.paragraphText"), shortcut: modShortcut("0"), action: () => run("paragraph") },
        { separator: true, label: "" },
        { label: tr("menu.bulletList"), shortcut: modShortcut("Shift+8"), action: () => run("bulletList") },
        { label: tr("menu.orderedList"), shortcut: modShortcut("Shift+7"), action: () => run("orderedList") },
        { label: tr("menu.taskList"), shortcut: modShortcut("Shift+X"), action: () => run("taskList") },
        { separator: true, label: "" },
        { label: tr("menu.blockquote"), shortcut: modShortcut("Shift+Q"), action: () => run("blockquote") },
        { label: tr("menu.hr"), action: () => run("hr") },
        { label: tr("menu.codeBlock"), shortcut: modShortcut("Shift+K"), action: () => run("codeBlock") },
        { label: tr("menu.toc"), action: () => run("toc") },
        { label: tr("menu.table"), shortcut: modShortcut("T"), action: () => run("table") },
        {
          label: tr("menu.tableEdit"),
          children: [
            { label: tr("table.toolbar.insertRowBelow"), action: () => run("tableRowBelow") },
            { label: tr("table.toolbar.insertRowAbove"), action: () => run("tableRowAbove") },
            { label: tr("table.toolbar.deleteRow"), action: () => run("tableRowDelete") },
            { separator: true, label: "" },
            { label: tr("table.toolbar.insertColLeft"), action: () => run("tableColLeft") },
            { label: tr("table.toolbar.insertColRight"), action: () => run("tableColRight") },
            { label: tr("table.toolbar.deleteCol"), action: () => run("tableColDelete") },
            { separator: true, label: "" },
            { label: tr("table.toolbar.alignLeft"), action: () => run("tableAlignLeft") },
            { label: tr("table.toolbar.alignCenter"), action: () => run("tableAlignCenter") },
            { label: tr("table.toolbar.alignRight"), action: () => run("tableAlignRight") },
            { separator: true, label: "" },
            { label: tr("table.toolbar.delete"), action: () => run("tableDelete") },
          ],
        },
        { label: tr("menu.mathBlock"), shortcut: modShortcut("Shift+M"), action: () => run("mathBlock") },
        { label: tr("menu.mermaid"), action: () => run("mermaid") },
      ],
    },
    {
      label: tr("menu.format"),
      items: [
        { label: tr("menu.bold"), shortcut: modShortcut("B"), action: () => run("bold") },
        { label: tr("menu.italic"), shortcut: modShortcut("I"), action: () => run("italic") },
        { label: tr("menu.strikethrough"), action: () => run("strikethrough") },
        { label: tr("menu.inlineCode"), shortcut: modShortcut("Shift+`"), action: () => run("inlineCode") },
        { label: tr("menu.highlight"), action: () => run("highlight") },
        { label: tr("menu.underline"), action: () => run("underline") },
        { label: tr("menu.superscript"), action: () => run("superscript") },
        { label: tr("menu.subscript"), action: () => run("subscript") },
        { separator: true, label: "" },
        { label: tr("menu.link"), shortcut: modShortcut("K"), action: () => run("link") },
        { label: tr("menu.image"), shortcut: modShortcut("Shift+I"), action: () => run("image") },
        { label: tr("menu.copyHtml"), action: () => run("copyHtml") },
      ],
    },
    {
      label: tr("menu.view"),
      items: [
        {
          label: tr("menu.sidebar"),
          shortcut: modShortcut("Shift+L"),
          action: cb.onToggleSidebar,
          checked: state.sidebarVisible,
        },
        ...(cb.onGlobalSearch
          ? [{ label: tr("menu.globalSearch"), shortcut: modShortcut("Shift+F"), action: cb.onGlobalSearch }]
          : []),
        { separator: true, label: "" },
        {
          label: tr("menu.preview"),
          action: () => cb.onSetEditorMode("preview"),
          checked: state.editorMode === "preview",
        },
        {
          label: tr("menu.source"),
          shortcut: modShortcut("/"),
          action: cb.onToggleEditorMode,
          checked: state.editorMode === "source",
        },
        { separator: true, label: "" },
        {
          label: tr("menu.focus"),
          shortcut: shortcut("F8"),
          action: cb.onToggleFocus,
          checked: state.focusMode,
        },
        {
          label: tr("menu.typewriter"),
          shortcut: shortcut("F9"),
          action: cb.onToggleTypewriter,
          checked: state.typewriterMode,
        },
        { separator: true, label: "" },
        {
          label: tr("menu.files"),
          action: () => cb.onSidebarTab("files"),
          checked: state.sidebarVisible && state.sidebarTab === "files",
        },
        {
          label: tr("menu.outline"),
          action: () => cb.onSidebarTab("outline"),
          checked: state.sidebarVisible && state.sidebarTab === "outline",
        },
        {
          label: tr("menu.recent"),
          action: () => cb.onSidebarTab("recent"),
          checked: state.sidebarVisible && state.sidebarTab === "recent",
        },
      ],
    },
    {
      label: tr("menu.help"),
      items: [
        {
          label: tr("menu.shortcuts"),
          action: cb.onOpenShortcuts,
        },
        {
          label: tr("menu.checkUpdates"),
          action: cb.onCheckUpdates,
        },
        {
          label: tr("menu.about"),
          action: cb.onOpenAbout,
        },
      ],
    },
  ];

  if (!state.documentEditable) {
    const disableItems = (items: MenuGroupDef["items"]) => {
      for (const item of items) {
        if (item.separator) continue;
        item.disabled = true;
        if (item.children) disableItems(item.children);
      }
    };

    const allowedEditLabels = new Set([tr("menu.copy"), tr("menu.selectAll"), tr("menu.find")]);
    for (const item of groups[1].items) {
      if (!item.separator && !allowedEditLabels.has(item.label)) item.disabled = true;
    }
    disableItems(groups[2].items);
    for (const item of groups[3].items) {
      if (!item.separator && item.label !== tr("menu.copyHtml")) item.disabled = true;
    }
    const sourceItem = groups[4].items.find((item) => item.label === tr("menu.source"));
    if (sourceItem) sourceItem.disabled = true;
  }

  return groups;
}
