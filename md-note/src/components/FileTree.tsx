import { useCallback, useEffect, useState, type MouseEvent } from "react";
import * as api from "../lib/tauri";
import { basename } from "../lib/paths";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";

interface Props {
  rootPath: string;
  currentPath: string | null;
  dirTick?: number;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
  onNewFile: (parentDir: string) => void;
  onNewFolder: (parentDir: string) => void;
  onRename: (path: string, isDir: boolean) => void;
  onDelete: (path: string, isDir: boolean) => void;
}

function TreeChevron({ expanded }: { expanded: boolean }) {
  return (
    <span className={`tree-chevron${expanded ? " is-expanded" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <path
          d="M6.5 4.5L10.5 8L6.5 11.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function IconNewFile() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.5 2.5h-4l-1-1H2.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-8l-1-1zm0 10.5h-11V2h5.5l1 1H12.5v10z" />
      <path d="M9.5 7.5h-2v-2h-1v2h-2v1h2v2h1v-2h2z" />
    </svg>
  );
}

function IconNewFolder() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M14.5 3H7.71l-.5-.5a.5.5 0 0 0-.42-.15H2.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5zM13 12.5H3V4.5h3.71l.5.5.5.5H13v7z" />
      <path d="M9.5 7.5h-2v-2h-1v2h-2v1h2v2h1v-2h2z" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 3.5A5.5 5.5 0 1 0 13.5 9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M13 1.5v2.5h-2.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="tree-node-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M4.5 1.5h4.5L12.5 5v9.5H4.5V1.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M9 1.5v3.5h3.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

interface MenuState {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
}

export default function FileTree({
  rootPath,
  currentPath,
  dirTick = 0,
  onOpenFile,
  onRefresh,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: Props) {
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [cache, setCache] = useState<Map<string, api.DirEntry[]>>(new Map());
  const [menu, setMenu] = useState<MenuState | null>(null);

  const loadDir = useCallback(async (path: string) => {
    try {
      const entries = await api.listDir(path);
      setCache((prev) => new Map(prev).set(path, entries));
    } catch {
      setCache((prev) => new Map(prev).set(path, []));
    }
  }, []);

  useEffect(() => {
    setExpanded(new Set());
    setCache(new Map());
    setRootExpanded(true);
    void loadDir(rootPath);
  }, [rootPath, dirTick, loadDir]);

  const toggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!cache.has(path)) void loadDir(path);
        }
        return next;
      });
    },
    [cache, loadDir],
  );

  const openContextMenu = useCallback((e: MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, path, isDir });
  }, []);

  const folderMenuItems = useCallback(
    (path: string): ContextMenuItem[] => [
      { label: "新建文件", onClick: () => onNewFile(path) },
      { label: "新建文件夹", onClick: () => onNewFolder(path) },
      { separator: true, label: "", onClick: () => {} },
      { label: "重命名", onClick: () => onRename(path, true) },
      { label: "删除", onClick: () => onDelete(path, true), danger: true },
    ],
    [onNewFile, onNewFolder, onRename, onDelete],
  );

  const fileMenuItems = useCallback(
    (path: string): ContextMenuItem[] => [
      { label: "重命名", onClick: () => onRename(path, false) },
      { label: "删除", onClick: () => onDelete(path, false), danger: true },
    ],
    [onRename, onDelete],
  );

  const renderDir = (path: string, depth: number) => {
    const entries = cache.get(path);
    if (!entries) {
      void loadDir(path);
      return null;
    }

    return entries.map((entry) => {
      const pad = 4 + depth * 12;
      if (entry.is_dir) {
        const open = expanded.has(entry.path);
        return (
          <li key={entry.path} className="tree-group">
            <div
              className="file-item tree-row"
              style={{ paddingLeft: pad }}
              onClick={() => toggle(entry.path)}
              onContextMenu={(e) => openContextMenu(e, entry.path, true)}
            >
              <TreeChevron expanded={open} />
              <span className="file-name">{entry.name}</span>
            </div>
            {open && (
              <ul className="file-list tree-children">
                {renderDir(entry.path, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      const isMd = /\.(md|markdown|txt)$/i.test(entry.name);
      if (!isMd) return null;

      const active = currentPath === entry.path;
      return (
        <li
          key={entry.path}
          className={active ? "file-item active tree-row" : "file-item tree-row"}
          style={{ paddingLeft: pad }}
          onClick={() => onOpenFile(entry.path)}
          onContextMenu={(e) => openContextMenu(e, entry.path, false)}
        >
          <FileIcon />
          <span className="file-name">{entry.name}</span>
        </li>
      );
    });
  };

  const workspaceName = basename(rootPath);
  const rootOpen = rootExpanded;

  return (
    <>
      <ul className="file-list file-tree">
        <li className="tree-group tree-root">
          <div
            className="file-item tree-row tree-root-row"
            style={{ paddingLeft: 4 }}
            onClick={() => setRootExpanded((v) => !v)}
            onContextMenu={(e) => openContextMenu(e, rootPath, true)}
          >
            <TreeChevron expanded={rootOpen} />
            <span className="file-name workspace-name" title={rootPath}>
              {workspaceName}
            </span>
            <div className="tree-row-actions">
              <button
                type="button"
                className="tree-action-btn"
                title="新建文件"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewFile(rootPath);
                }}
              >
                <IconNewFile />
              </button>
              <button
                type="button"
                className="tree-action-btn"
                title="新建文件夹"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewFolder(rootPath);
                }}
              >
                <IconNewFolder />
              </button>
              <button
                type="button"
                className="tree-action-btn"
                title="刷新"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
              >
                <IconRefresh />
              </button>
            </div>
          </div>
          {rootOpen && (
            <ul className="file-list tree-children">
              {renderDir(rootPath, 1)}
            </ul>
          )}
        </li>
      </ul>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.isDir ? folderMenuItems(menu.path) : fileMenuItems(menu.path)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
