import { useMemo } from "react";
import { isMac } from "../lib/tauri";
import MenuBar from "./MenuBar";
import { buildMenuGroups } from "./menus";
import WindowControls from "./WindowControls";
import appIcon from "../assets/app-icon.svg";
import type { SidebarTab } from "./Sidebar";
import type { EditorAction, EditorMode } from "../editor";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

interface Props {
  locale: Locale;
  fileName: string;
  dirty: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  sidebarVisible: boolean;
  sidebarTab: SidebarTab;
  editorMode: EditorMode;
  onOpen: () => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
  onCloseFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onEditorAction: (action: EditorAction) => void;
  onToggleSidebar: () => void;
  onSidebarTab: (tab: SidebarTab) => void;
  onSetEditorMode: (mode: EditorMode) => void;
  onToggleEditorMode: () => void;
  onToggleFocus: () => void;
  onToggleTypewriter: () => void;
  onOpenSettings: () => void;
}

export default function Titlebar({
  locale,
  fileName,
  dirty,
  focusMode,
  typewriterMode,
  sidebarVisible,
  sidebarTab,
  editorMode,
  onOpen,
  onOpenFolder,
  onNewFile,
  onCloseFile,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onEditorAction,
  onToggleSidebar,
  onSidebarTab,
  onSetEditorMode,
  onToggleEditorMode,
  onToggleFocus,
  onToggleTypewriter,
  onOpenSettings,
}: Props) {
  const menuGroups = useMemo(
    () =>
      buildMenuGroups(
        {
          onNewFile,
          onOpen,
          onOpenFolder,
          onCloseFile,
          onSave,
          onSaveAs,
          onExportHtml,
          onExportPdf,
          onOpenSettings,
          onEditorAction,
          onToggleSidebar,
          onSidebarTab,
          onSetEditorMode,
          onToggleEditorMode,
          onToggleFocus,
          onToggleTypewriter,
        },
        {
          sidebarVisible,
          sidebarTab,
          editorMode,
          focusMode,
          typewriterMode,
        },
        locale,
      ),
    [
      locale,
      onNewFile,
      onOpen,
      onOpenFolder,
      onCloseFile,
      onSave,
      onSaveAs,
      onExportHtml,
      onExportPdf,
      onOpenSettings,
      onEditorAction,
      onToggleSidebar,
      onSidebarTab,
      onSetEditorMode,
      onToggleEditorMode,
      onToggleFocus,
      onToggleTypewriter,
      sidebarVisible,
      sidebarTab,
      editorMode,
      focusMode,
      typewriterMode,
    ],
  );

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        {isMac && <WindowControls />}
        <div className="titlebar-app-icon" aria-hidden="true">
          <img src={appIcon} alt="" width={16} height={16} draggable={false} />
        </div>
        <MenuBar groups={menuGroups} />
      </div>

      <div className="titlebar-center" data-tauri-drag-region="">
        <span className="titlebar-brand">MDNote</span>
        <span className="titlebar-dot" aria-hidden="true">·</span>
        <span className="file-name" title={fileName}>
          {fileName}
        </span>
        {dirty && (
          <span className="dirty-dot" title={t(locale, "title.unsaved")}>
            ●
          </span>
        )}
      </div>

      <div className="titlebar-right">
        {!isMac && <WindowControls />}
      </div>
    </header>
  );
}
