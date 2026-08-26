import { useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { isPathUnder } from "../lib/paths";
import FileTree, { type TreeClipboard } from "./FileTree";

export type SidebarTab = "files" | "outline" | "recent";

interface Props {
  locale: Locale;
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  folderPaths: string[];
  dirTick?: number;
  onOpenPath: (path: string) => void;
  onRefreshTree?: () => void;
  onCreateFileInDir?: (parentDir: string, name: string) => void | Promise<void>;
  onCreateFolderInDir?: (parentDir: string, name: string) => void | Promise<void>;
  onRenamePath?: (path: string, newName: string, isDir: boolean) => boolean | Promise<boolean>;
  onMovePath?: (oldPath: string, newPath: string) => void;
  onDeletePath?: (path: string, isDir: boolean) => boolean | Promise<boolean>;
  outline: { level: number; text: string; line: number }[];
  activeOutlineLine: number | null;
  onOutlineClick: (line: number) => void;
  currentPath: string | null;
  recentFiles: string[];
  onRemoveRecent: (path: string) => void;
  onOpenFolder?: () => void;
  onRemoveFolder?: (path: string) => void;
  onError?: (e: unknown) => void;
  revealRequest?: { path: string; id: number } | null;
  renameRequest?: { path: string; id: number } | null;
  onRenameRequestHandled?: (id: number) => void;
  dropTargetDir?: string | null;
}

export default function Sidebar({
  locale,
  tab,
  onTab,
  folderPaths,
  dirTick = 0,
  onOpenPath,
  onRefreshTree,
  onCreateFileInDir,
  onCreateFolderInDir,
  onRenamePath,
  onMovePath,
  onDeletePath,
  outline,
  activeOutlineLine,
  onOutlineClick,
  currentPath,
  recentFiles,
  onRemoveRecent,
  onOpenFolder,
  onRemoveFolder,
  onError,
  revealRequest,
  renameRequest,
  onRenameRequestHandled,
  dropTargetDir,
}: Props) {
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);
  const outlineListRef = useRef<HTMLUListElement>(null);
  const [fileFilter, setFileFilter] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [treeClipboard, setTreeClipboard] = useState<TreeClipboard | null>(null);

  useEffect(() => {
    setSelectedPath(
      currentPath && folderPaths.some((rootPath) => isPathUnder(currentPath, rootPath))
        ? currentPath
        : null,
    );
  }, [currentPath, folderPaths]);

  useEffect(() => {
    setTreeClipboard((value) => (
      value && folderPaths.some((rootPath) => isPathUnder(value.path, rootPath)) ? value : null
    ));
  }, [folderPaths]);

  useEffect(() => {
    if (!revealRequest) return;
    setFileFilter("");
    setSelectedPath(revealRequest.path);
  }, [revealRequest]);

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
            {folderPaths.length === 0 ? (
              <div className="empty empty-action">
                <p>{tr("sidebar.emptyFolder")}</p>
                {onOpenFolder && (
                  <button type="button" className="btn-secondary btn-sm" onClick={onOpenFolder}>
                    {tr("sidebar.openFolderBtn")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="file-tree-filter">
                  <input
                    type="search"
                    className="file-tree-filter-input"
                    placeholder={tr("tree.filter")}
                    value={fileFilter}
                    onChange={(event) => setFileFilter(event.target.value)}
                  />
                </div>
                {folderPaths.map((rootPath) => (
                  <FileTree
                    key={rootPath}
                    locale={locale}
                    rootPath={rootPath}
                    filter={fileFilter}
                    selectedPath={selectedPath}
                    onSelectedPathChange={setSelectedPath}
                    clipboard={treeClipboard}
                    onClipboardChange={setTreeClipboard}
                    dirTick={dirTick}
                    onOpenFile={onOpenPath}
                    onRefresh={onRefreshTree ?? (() => {})}
                    onCreateFile={onCreateFileInDir ?? (async () => {})}
                    onCreateFolder={onCreateFolderInDir ?? (async () => {})}
                    onRenamePath={onRenamePath ?? (async () => false)}
                    onMovePath={onMovePath}
                    onDelete={onDeletePath ?? (() => false)}
                    onRemoveRoot={onRemoveFolder}
                    onError={onError}
                    renameRequest={renameRequest}
                    onRenameRequestHandled={onRenameRequestHandled}
                    dropTargetDir={dropTargetDir}
                  />
                ))}
              </>
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
