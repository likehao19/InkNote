import { useMemo } from "react";
import { isMac } from "../lib/tauri";
import { modShortcut } from "../lib/shortcuts";
import MenuBar, { type MenuGroupDef } from "./MenuBar";
import WindowControls from "./WindowControls";

interface Props {
  fileName: string;
  dirty: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  sidebarVisible: boolean;
  onOpen: () => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
  onCloseFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onToggleSidebar: () => void;
  onToggleFocus: () => void;
  onToggleTypewriter: () => void;
  onOpenSettings: () => void;
}

export default function Titlebar({
  fileName,
  dirty,
  focusMode,
  typewriterMode,
  sidebarVisible,
  onOpen,
  onOpenFolder,
  onNewFile,
  onCloseFile,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onToggleSidebar,
  onToggleFocus,
  onToggleTypewriter,
  onOpenSettings,
}: Props) {
  const menuGroups = useMemo<MenuGroupDef[]>(
    () => [
      {
        label: "文件",
        items: [
          { label: "新建", shortcut: modShortcut("N"), action: onNewFile },
          { label: "打开文件…", shortcut: modShortcut("O"), action: onOpen },
          { label: "打开文件夹…", action: onOpenFolder },
          { separator: true, label: "" },
          { label: "关闭文件", shortcut: modShortcut("W"), action: onCloseFile },
          { separator: true, label: "" },
          { label: "保存", shortcut: modShortcut("S"), action: onSave },
          { label: "另存为…", shortcut: `${modShortcut("Shift+S")}`, action: onSaveAs },
          { separator: true, label: "" },
          { label: "导出 HTML…", action: onExportHtml },
          { label: "导出 PDF…", action: onExportPdf },
          { separator: true, label: "" },
          { label: "设置…", shortcut: modShortcut(","), action: onOpenSettings },
        ],
      },
      {
        label: "视图",
        items: [
          { label: "切换侧边栏", action: onToggleSidebar, checked: sidebarVisible },
          { label: "专注模式", action: onToggleFocus, checked: focusMode },
          { label: "打字机模式", action: onToggleTypewriter, checked: typewriterMode },
        ],
      },
    ],
    [
      onOpen,
      onOpenFolder,
      onNewFile,
      onCloseFile,
      onSave,
      onSaveAs,
      onExportHtml,
      onExportPdf,
      onOpenSettings,
      onToggleSidebar,
      onToggleFocus,
      onToggleTypewriter,
      sidebarVisible,
      focusMode,
      typewriterMode,
    ],
  );

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        {isMac && <WindowControls />}
        <MenuBar groups={menuGroups} />
      </div>

      <div className="titlebar-center" data-tauri-drag-region="">
        <span className="titlebar-brand">MDNote</span>
        <span className="titlebar-dot" aria-hidden="true">·</span>
        <span className="file-name" title={fileName}>
          {fileName}
        </span>
        {dirty && (
          <span className="dirty-dot" title="未保存">
            ●
          </span>
        )}
      </div>

      <div className="titlebar-right">
        <button
          className="titlebar-icon-btn"
          onClick={onOpenSettings}
          title={`设置 (${modShortcut(",")})`}
          aria-label="设置"
          data-tauri-drag-region={false}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M6.5 1h3l.4 1.6c.3.1.6.3.9.5l1.5-.7 1.5 2.6-.9 1.2c0 .3 0 .6 0 .8l.9 1.2-1.5 2.6-1.5-.7c-.3.2-.6.4-.9.5L9.5 15h-3l-.4-1.6c-.3-.1-.6-.3-.9-.5l-1.5.7-1.5-2.6.9-1.2c0-.3 0-.6 0-.8l-.9-1.2 1.5-2.6 1.5.7c.3-.2.6-.4.9-.5L6.5 1z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        {!isMac && <WindowControls />}
      </div>
    </header>
  );
}
