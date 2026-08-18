import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import * as api from "../lib/tauri";
import { basename, dirOf, isPathUnder, joinPath, remapPath, relativeToWorkspace } from "../lib/paths";
import { modShortcut } from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";

interface Props {
  locale: Locale;
  rootPath: string;
  currentPath: string | null;
  dirTick?: number;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
  onCreateFile: (parentDir: string, name: string) => void | Promise<void>;
  onCreateFolder: (parentDir: string, name: string) => void | Promise<void>;
  onRenamePath: (path: string, newName: string, isDir: boolean) => void | Promise<void>;
  onDelete: (path: string, isDir: boolean) => void;
}

type CreatingState = {
  parentDir: string;
  kind: "file" | "folder";
  depth: number;
};

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

function InlineNameInput({
  kind,
  defaultValue,
  onCommit,
  onCancel,
}: {
  kind: "file" | "folder";
  defaultValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const dot = defaultValue.lastIndexOf(".");
    if (dot > 0) {
      input.setSelectionRange(0, dot);
    } else {
      input.select();
    }
  }, [defaultValue]);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const value = inputRef.current?.value.trim() ?? "";
    if (value) onCommit(value);
    else onCancel();
  };

  return (
    <>
      {kind === "file" ? <FileIcon /> : <TreeChevron expanded={false} />}
      <input
        ref={inputRef}
        type="text"
        className="tree-inline-input"
        defaultValue={defaultValue}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            committedRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => commit()}
      />
    </>
  );
}

interface MenuState {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
  depth: number;
}

type TreeClipboard = {
  mode: "copy" | "cut";
  path: string;
};

type RenamingState = {
  path: string;
  isDir: boolean;
  depth: number;
};

export default function FileTree({
  locale,
  rootPath,
  currentPath,
  dirTick = 0,
  onOpenFile,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  onRenamePath,
  onDelete,
}: Props) {
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [cache, setCache] = useState<Map<string, api.DirEntry[]>>(new Map());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [renaming, setRenaming] = useState<RenamingState | null>(null);
  const [clipboard, setClipboard] = useState<TreeClipboard | null>(null);
  const tr = useCallback(
    (key: Parameters<typeof t>[1]) => t(locale, key),
    [locale],
  );
  const expandedRef = useRef(expanded);
  const cacheRef = useRef(cache);
  expandedRef.current = expanded;
  cacheRef.current = cache;

  const loadDir = useCallback(async (path: string) => {
    try {
      const entries = await api.listDir(path);
      setCache((prev) => new Map(prev).set(path, entries));
    } catch {
      setCache((prev) => new Map(prev).set(path, []));
    }
  }, []);

  const reloadVisibleDirectories = useCallback(() => {
    const paths = new Set<string>([rootPath]);
    expandedRef.current.forEach((p) => paths.add(p));
    cacheRef.current.forEach((_, p) => paths.add(p));
    void Promise.all([...paths].map((p) => loadDir(p)));
  }, [rootPath, loadDir]);

  const selectNode = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  useEffect(() => {
    if (currentPath) setSelectedPath(currentPath);
  }, [currentPath]);

  useEffect(() => {
    setExpanded(new Set());
    setCache(new Map());
    setRootExpanded(true);
    setCreating(null);
    setRenaming(null);
    setSelectedPath(null);
    void loadDir(rootPath);
  }, [rootPath, loadDir]);

  useEffect(() => {
    if (dirTick === 0) return;
    reloadVisibleDirectories();
  }, [dirTick, reloadVisibleDirectories]);

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

  const startCreate = useCallback(
    (parentDir: string, kind: CreatingState["kind"], depth: number) => {
      setMenu(null);
      setRenaming(null);
      if (parentDir === rootPath) {
        setRootExpanded(true);
      } else {
        setExpanded((prev) => new Set(prev).add(parentDir));
        if (!cache.has(parentDir)) void loadDir(parentDir);
      }
      setCreating({ parentDir, kind, depth });
    },
    [rootPath, cache, loadDir],
  );

  const commitCreate = useCallback(
    async (name: string) => {
      if (!creating) return;
      const { parentDir, kind } = creating;
      setCreating(null);
      try {
        if (kind === "file") await onCreateFile(parentDir, name);
        else await onCreateFolder(parentDir, name);
      } catch (e) {
        console.error(e);
      }
    },
    [creating, onCreateFile, onCreateFolder],
  );

  const startRename = useCallback((path: string, isDir: boolean, depth: number) => {
    setMenu(null);
    setCreating(null);
    setRenaming({ path, isDir, depth });
  }, []);

  const commitRename = useCallback(
    async (name: string) => {
      if (!renaming) return;
      const { path, isDir } = renaming;
      const current = basename(path);
      if (!name || name === current) {
        setRenaming(null);
        return;
      }
      const newPath = joinPath(dirOf(path), name);
      setRenaming(null);
      setExpanded((prev) => {
        const next = new Set<string>();
        for (const p of prev) {
          next.add(remapPath(p, path, newPath));
        }
        return next;
      });
      setCache((prev) => {
        const next = new Map<string, api.DirEntry[]>();
        for (const [p, entries] of prev) {
          next.set(remapPath(p, path, newPath), entries);
        }
        return next;
      });
      setSelectedPath((prev) => (prev ? remapPath(prev, path, newPath) : prev));
      try {
        await onRenamePath(path, name, isDir);
      } catch (e) {
        console.error(e);
      }
    },
    [renaming, onRenamePath],
  );

  const handleDelete = useCallback(
    (path: string, isDir: boolean) => {
      setExpanded((prev) => {
        const next = new Set<string>();
        for (const p of prev) {
          if (!isPathUnder(p, path)) next.add(p);
        }
        return next;
      });
      setCache((prev) => {
        const next = new Map<string, api.DirEntry[]>();
        for (const [p, entries] of prev) {
          if (!isPathUnder(p, path)) next.set(p, entries);
        }
        return next;
      });
      setSelectedPath((prev) => (prev && isPathUnder(prev, path) ? null : prev));
      onDelete(path, isDir);
    },
    [onDelete],
  );

  const renderInlineRename = (
    state: RenamingState,
    kind: "file" | "folder",
  ) => (
    <InlineNameInput
      kind={kind}
      defaultValue={basename(state.path)}
      onCommit={(name) => void commitRename(name)}
      onCancel={() => setRenaming(null)}
    />
  );

  const renderInlineCreate = (state: CreatingState) => {
    const pad = 4 + state.depth * 12;
    const defaultValue = state.kind === "file" ? tr("tree.untitledFile") : tr("tree.newFolderName");
    return (
      <li
        key="__creating__"
        className="file-item tree-row tree-inline-input-row"
        style={{ paddingLeft: pad }}
        onClick={(e) => e.stopPropagation()}
      >
        <InlineNameInput
          kind={state.kind}
          defaultValue={defaultValue}
          onCommit={(name) => void commitCreate(name)}
          onCancel={() => setCreating(null)}
        />
      </li>
    );
  };

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const copyRelativePath = useCallback(
    (path: string) => void copyText(relativeToWorkspace(rootPath, path)),
    [rootPath, copyText],
  );

  const copyAbsolutePath = useCallback(
    (path: string) => void copyText(path),
    [copyText],
  );

  const revealInExplorer = useCallback(async (path: string) => {
    try {
      await revealItemInDir(path);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const copyFile = useCallback((path: string) => {
    setClipboard({ mode: "copy", path });
  }, []);

  const cutFile = useCallback((path: string) => {
    setClipboard({ mode: "cut", path });
  }, []);

  const pasteInto = useCallback(
    async (destDir: string) => {
      if (!clipboard) return;
      const { mode, path } = clipboard;
      try {
        if (mode === "copy") {
          await api.copyFileToDir(path, destDir);
        } else {
          const dest = joinPath(destDir, basename(path));
          if (dest !== path) {
            await api.renamePath(path, dest);
            setClipboard(null);
          }
        }
        onRefresh();
      } catch (e) {
        console.error(e);
      }
    },
    [clipboard, onRefresh],
  );

  const clipboardMenuItems = useCallback(
    (path: string, isDir: boolean, pasteTarget: string): ContextMenuItem[] => {
      const canTransfer = !isDir;
      return [
        {
          label: tr("menu.cut"),
          shortcut: modShortcut("X"),
          accelerator: "Mod+x",
          disabled: !canTransfer,
          onClick: () => cutFile(path),
        },
        {
          label: tr("menu.copy"),
          shortcut: modShortcut("C"),
          accelerator: "Mod+c",
          disabled: !canTransfer,
          onClick: () => copyFile(path),
        },
        {
          label: tr("menu.paste"),
          shortcut: modShortcut("V"),
          accelerator: "Mod+v",
          disabled: !clipboard,
          onClick: () => void pasteInto(pasteTarget),
        },
        { separator: true, label: "", onClick: () => {} },
        {
          label: tr("tree.copyRelativePath"),
          onClick: () => void copyRelativePath(path),
        },
        {
          label: tr("tree.copyAbsolutePath"),
          onClick: () => void copyAbsolutePath(path),
        },
      ];
    },
    [clipboard, cutFile, copyFile, pasteInto, copyRelativePath, copyAbsolutePath, tr],
  );

  const openContextMenu = useCallback(
    (e: MouseEvent, path: string, isDir: boolean, depth: number) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedPath(path);
      setMenu({ x: e.clientX, y: e.clientY, path, isDir, depth });
    },
    [],
  );

  const folderMenuItems = useCallback(
    (path: string, depth: number): ContextMenuItem[] => [
      {
        label: tr("tree.newFile"),
        shortcut: "Alt+N",
        accelerator: "n",
        onClick: () => startCreate(path, "file", depth + 1),
      },
      {
        label: tr("tree.newFolder"),
        shortcut: "Alt+Shift+N",
        accelerator: "N",
        onClick: () => startCreate(path, "folder", depth + 1),
      },
      { separator: true, label: "", onClick: () => {} },
      ...clipboardMenuItems(path, true, path),
      { separator: true, label: "", onClick: () => {} },
      {
        label: tr("tree.revealInExplorer"),
        shortcut: modShortcut("Shift+E"),
        onClick: () => void revealInExplorer(path),
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: tr("tree.rename"),
        shortcut: "F2",
        accelerator: "F2",
        onClick: () => startRename(path, true, depth),
        disabled: path === rootPath,
      },
      {
        label: tr("tree.delete"),
        shortcut: "Delete",
        accelerator: "Delete",
        onClick: () => handleDelete(path, true),
        disabled: path === rootPath,
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: tr("tree.refresh"),
        shortcut: "F5",
        accelerator: "F5",
        onClick: () => onRefresh(),
      },
    ],
    [
      clipboard,
      startCreate,
      startRename,
      pasteInto,
      clipboardMenuItems,
      handleDelete,
      onRefresh,
      revealInExplorer,
      rootPath,
      tr,
    ],
  );

  const fileMenuItems = useCallback(
    (path: string, depth: number): ContextMenuItem[] => [
      {
        label: tr("tree.open"),
        shortcut: "Enter",
        accelerator: "Enter",
        onClick: () => onOpenFile(path),
      },
      { separator: true, label: "", onClick: () => {} },
      ...clipboardMenuItems(path, false, dirOf(path)),
      { separator: true, label: "", onClick: () => {} },
      {
        label: tr("tree.revealInExplorer"),
        shortcut: modShortcut("Shift+E"),
        onClick: () => void revealInExplorer(path),
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: tr("tree.rename"),
        shortcut: "F2",
        accelerator: "F2",
        onClick: () => startRename(path, false, depth),
      },
      {
        label: tr("tree.delete"),
        shortcut: "Delete",
        accelerator: "Delete",
        onClick: () => handleDelete(path, false),
      },
    ],
    [
      onOpenFile,
      clipboardMenuItems,
      startRename,
      handleDelete,
      revealInExplorer,
      tr,
    ],
  );

  const contextMenuItems = useMemo(() => {
    if (!menu) return [];
    return menu.isDir
      ? folderMenuItems(menu.path, menu.depth)
      : fileMenuItems(menu.path, menu.depth);
  }, [menu, folderMenuItems, fileMenuItems]);

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
        const isRenaming = renaming?.path === entry.path;
        const isSelected = selectedPath === entry.path;
        return (
          <li key={entry.path} className="tree-group">
            <div
              className={[
                "file-item",
                "tree-row",
                isSelected ? "active" : "",
                isRenaming ? "tree-inline-input-row" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ paddingLeft: pad }}
              onClick={() => {
                if (isRenaming) return;
                selectNode(entry.path);
              }}
              onContextMenu={(e) => openContextMenu(e, entry.path, true, depth)}
            >
              {isRenaming && renaming ? (
                renderInlineRename(renaming, "folder")
              ) : (
                <>
                  <button
                    type="button"
                    className="tree-chevron-btn"
                    aria-label={open ? tr("tree.collapseFolder") : tr("tree.expandFolder")}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(entry.path);
                    }}
                  >
                    <TreeChevron expanded={open} />
                  </button>
                  <span className="file-name">{entry.name}</span>
                </>
              )}
            </div>
            {open && (
              <ul className="file-list tree-children">
                {creating?.parentDir === entry.path && renderInlineCreate(creating)}
                {renderDir(entry.path, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      const isMd = /\.(md|markdown|txt)$/i.test(entry.name);
      if (!isMd) return null;

      const isSelected = selectedPath === entry.path;
      const isRenaming = renaming?.path === entry.path;
      return (
        <li
          key={entry.path}
          className={[
            "file-item",
            "tree-row",
            isSelected ? "active" : "",
            isRenaming ? "tree-inline-input-row" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ paddingLeft: pad }}
          onClick={() => {
            if (isRenaming) return;
            selectNode(entry.path);
            onOpenFile(entry.path);
          }}
          onContextMenu={(e) => openContextMenu(e, entry.path, false, depth)}
        >
          {isRenaming && renaming ? (
            renderInlineRename(renaming, "file")
          ) : (
            <>
              <FileIcon />
              <span className="file-name">{entry.name}</span>
            </>
          )}
        </li>
      );
    });
  };

  const workspaceName = basename(rootPath);
  const rootOpen = rootExpanded;
  const rootSelected = selectedPath === rootPath;

  return (
    <>
      <ul className="file-list file-tree">
        <li className="tree-group tree-root">
          <div
            className={[
              "file-item",
              "tree-row",
              "tree-root-row",
              rootSelected ? "active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ paddingLeft: 4 }}
            onClick={() => selectNode(rootPath)}
            onContextMenu={(e) => openContextMenu(e, rootPath, true, 0)}
          >
            <button
              type="button"
              className="tree-chevron-btn"
              aria-label={rootOpen ? tr("tree.collapseWorkspace") : tr("tree.expandWorkspace")}
              onClick={(e) => {
                e.stopPropagation();
                setRootExpanded((v) => !v);
              }}
            >
              <TreeChevron expanded={rootOpen} />
            </button>
            <span className="file-name workspace-name" title={rootPath}>
              {workspaceName}
            </span>
            <div className="tree-row-actions">
              <button
                type="button"
                className="tree-action-btn"
                title={tr("tree.newFile")}
                onClick={(e) => {
                  e.stopPropagation();
                  startCreate(rootPath, "file", 1);
                }}
              >
                <IconNewFile />
              </button>
              <button
                type="button"
                className="tree-action-btn"
                title={tr("tree.newFolder")}
                onClick={(e) => {
                  e.stopPropagation();
                  startCreate(rootPath, "folder", 1);
                }}
              >
                <IconNewFolder />
              </button>
              <button
                type="button"
                className="tree-action-btn"
                title={tr("tree.refresh")}
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
              {creating?.parentDir === rootPath && renderInlineCreate(creating)}
              {renderDir(rootPath, 1)}
            </ul>
          )}
        </li>
      </ul>
      {menu && (
        <ContextMenu
          variant="tree"
          x={menu.x}
          y={menu.y}
          items={contextMenuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
