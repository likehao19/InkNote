import { useMemo } from "react";
import { isMac } from "../lib/tauri";
import { isLinux } from "../lib/platform";
import MenuBar from "./MenuBar";
import { buildMenuGroups } from "./menus";
import WindowControls from "./WindowControls";
import UpdateProgress, { type UpdateProgressState } from "./UpdateProgress";
import appIcon from "../../src-tauri/icons/32x32.png";
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
  documentEditable: boolean;
  updateState: UpdateProgressState | null;
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
  onOpenShortcuts: () => void;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
  onOpenAbout: () => void;
  onGlobalSearch?: () => void;
  onQuickOpen?: () => void;
  onOpenRecent: (path: string) => void;
  onReopenClosed?: () => void;
  canReopenClosed?: boolean;
  recentFiles: string[];
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
  documentEditable,
  updateState,
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
  onOpenShortcuts,
  onCheckUpdates,
  onInstallUpdate,
  onOpenAbout,
  onGlobalSearch,
  onQuickOpen,
  onOpenRecent,
  onReopenClosed,
  canReopenClosed,
  recentFiles,
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
          onOpenShortcuts,
          onCheckUpdates,
          onOpenAbout,
          onGlobalSearch,
          onQuickOpen,
          onOpenRecent,
          onReopenClosed,
        },
        {
          sidebarVisible,
          sidebarTab,
          editorMode,
          focusMode,
          typewriterMode,
          recentFiles,
          canReopenClosed,
          documentEditable,
          pdfExportSupported: !isLinux,
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
      onOpenShortcuts,
      onCheckUpdates,
      onOpenAbout,
      onGlobalSearch,
      onQuickOpen,
      onOpenRecent,
      onReopenClosed,
      recentFiles,
      canReopenClosed,
      sidebarVisible,
      sidebarTab,
      editorMode,
      focusMode,
      typewriterMode,
      documentEditable,
    ],
  );

  const documentTitle = (
    <>
      <span className="titlebar-brand">{t(locale, "title.brand")}</span>
      <span className="titlebar-dot" aria-hidden="true">·</span>
      <span className="file-name" title={fileName}>
        {fileName}
      </span>
      {dirty && (
        <span className="dirty-badge" title={t(locale, "title.unsaved")}>
          {t(locale, "title.unsaved")}
        </span>
      )}
    </>
  );

  // macOS 保留系统菜单和交通灯，仅用 WebView 绘制可交互的 Overlay 标题栏。
  if (isMac) {
    return (
      <header className="titlebar titlebar-mac" data-tauri-drag-region="">
        <div className="titlebar-mac-leading" data-tauri-drag-region="" />
        <div className="titlebar-center" data-tauri-drag-region="">
          {documentTitle}
        </div>
        <div className="titlebar-right">
          <UpdateProgress locale={locale} state={updateState} onInstall={onInstallUpdate} />
        </div>
      </header>
    );
  }

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        {isMac && <WindowControls locale={locale} />}
        <div className="titlebar-app-icon" aria-hidden="true">
          <img src={appIcon} alt="" width={16} height={16} draggable={false} />
        </div>
        <MenuBar groups={menuGroups} />
      </div>

      <div className="titlebar-center" data-tauri-drag-region="">
        {documentTitle}
      </div>

      <div className="titlebar-right">
        <UpdateProgress locale={locale} state={updateState} onInstall={onInstallUpdate} />
        {!isMac && <WindowControls locale={locale} />}
      </div>
    </header>
  );
}
