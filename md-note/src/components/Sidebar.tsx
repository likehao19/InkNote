import { useEffect, useRef } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import FileTree from "./FileTree";

export type SidebarTab = "files" | "outline" | "recent";

interface Props {
  locale: Locale;
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  folderPath: string | null;
  dirTick?: number;
  onOpenPath: (path: string) => void;
  onRefreshTree?: () => void;
  onCreateFileInDir?: (parentDir: string, name: string) => void | Promise<void>;
  onCreateFolderInDir?: (parentDir: string, name: string) => void | Promise<void>;
  onRenamePath?: (path: string, newName: string, isDir: boolean) => void | Promise<void>;
  onDeletePath?: (path: string, isDir: boolean) => void;
  outline: { level: number; text: string; line: number }[];
  activeOutlineLine: number | null;
  onOutlineClick: (line: number) => void;
  currentPath: string | null;
  recentFiles: string[];
  onRemoveRecent: (path: string) => void;
  onOpenFolder?: () => void;
  onError?: (e: unknown) => void;
}

export default function Sidebar({
  locale,
  tab,
  onTab,
  folderPath,
  dirTick = 0,
  onOpenPath,
  onRefreshTree,
  onCreateFileInDir,
  onCreateFolderInDir,
  onRenamePath,
  onDeletePath,
  outline,
  activeOutlineLine,
  onOutlineClick,
  currentPath,
  recentFiles,
  onRemoveRecent,
  onOpenFolder,
  onError,
}: Props) {
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);
  const outlineListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (tab !== "outline" || !activeOutlineLine) return;
    const list = outlineListRef.current;
    if (!list) return;
    const active = list.querySelector(".outline-item.active");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [tab, activeOutlineLine]);

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button type="button" className={tab === "files" ? "tab active" : "tab"} onClick={() => onTab("files")}>
          {tr("sidebar.files")}
        </button>
        <button type="button" className={tab === "outline" ? "tab active" : "tab"} onClick={() => onTab("outline")}>
          {tr("sidebar.outline")}
        </button>
        <button type="button" className={tab === "recent" ? "tab active" : "tab"} onClick={() => onTab("recent")}>
          {tr("sidebar.recent")}
        </button>
      </div>

      <div className="sidebar-body">
        {tab === "files" ? (
          <div className="file-panel">
            {!folderPath ? (
              <div className="empty empty-action">
                <p>{tr("sidebar.emptyFolder")}</p>
                {onOpenFolder && (
                  <button type="button" className="btn-secondary btn-sm" onClick={onOpenFolder}>
                    {tr("sidebar.openFolderBtn")}
                  </button>
                )}
              </div>
            ) : (
              <FileTree
                locale={locale}
                rootPath={folderPath}
                currentPath={currentPath}
                dirTick={dirTick}
                onOpenFile={onOpenPath}
                onRefresh={onRefreshTree ?? (() => {})}
                onCreateFile={onCreateFileInDir ?? (async () => {})}
                onCreateFolder={onCreateFolderInDir ?? (async () => {})}
                onRenamePath={onRenamePath ?? (async () => {})}
                onDelete={onDeletePath ?? (() => {})}
                onError={onError}
              />
            )}
          </div>
        ) : tab === "outline" ? (
          <div className="outline-panel">
            {outline.length === 0 ? (
              <div className="empty">{tr("sidebar.emptyOutline")}</div>
            ) : (
              <ul className="outline-list" ref={outlineListRef}>
                {outline.map((h, i) => (
                  <li
                    key={i}
                    className={h.line === activeOutlineLine ? "outline-item active" : "outline-item"}
                    style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
                    onClick={() => onOutlineClick(h.line)}
                  >
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="recent-panel">
            {recentFiles.length === 0 ? (
              <div className="empty">{tr("sidebar.emptyRecent")}</div>
            ) : (
              <ul className="recent-list">
                {recentFiles.map((p) => {
                  const parts = p.split(/[\\/]/);
                  const name = parts.pop() || p;
                  const parent = parts.join(p.includes("\\") ? "\\" : "/");
                  const active = currentPath === p;
                  return (
                    <li
                      key={p}
                      className={active ? "recent-item active" : "recent-item"}
                      title={p}
                    >
                      <button
                        type="button"
                        className="recent-item-main"
                        onClick={() => onOpenPath(p)}
                      >
                        <span className="recent-name">{name}</span>
                        {parent ? <span className="recent-dir">{parent}</span> : null}
                      </button>
                      <button
                        type="button"
                        className="recent-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(p);
                        }}
                        title={tr("sidebar.removeRecent")}
                        aria-label={tr("sidebar.removeRecent")}
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                          <path
                            d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
