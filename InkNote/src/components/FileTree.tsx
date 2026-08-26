import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import * as api from "../lib/tauri";
import { basename, dirOf, isPathUnder, joinPath, remapPath, relativeToWorkspace } from "../lib/paths";
import { altShortcut, deleteShortcut, modShortcut } from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import { invalidateWorkspaceFileCache, listWorkspaceFiles } from "../lib/workspaceSearch";
import { getTreeExpansion, setTreeExpansion } from "../lib/treeState";
import { isMac } from "../lib/platform";
import { isManagedImageAssetDir } from "../lib/imageAssets";

interface Props {
  locale: Locale;
  rootPath: string;
  filter?: string;
  selectedPath: string | null;
  onSelectedPathChange: (path: string | null) => void;
  clipboard: TreeClipboard | null;
  onClipboardChange: (clipboard: TreeClipboard | null) => void;
  dirTick?: number;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
  onCreateFile: (parentDir: string, name: string) => void | Promise<void>;
  onCreateFolder: (parentDir: string, name: string) => void | Promise<void>;
  onRenamePath: (path: string, newName: string, isDir: boolean) => boolean | Promise<boolean>;
  onMovePath?: (oldPath: string, newPath: string) => void;
  onDelete: (path: string, isDir: boolean) => boolean | Promise<boolean>;
  onRemoveRoot?: (path: string) => void;
  onError?: (e: unknown) => void;
  renameRequest?: { path: string; id: number } | null;
  onRenameRequestHandled?: (id: number) => void;
  dropTargetDir?: string | null;
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

function HighlightedTreeName({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let from = 0;
  while (from < text.length) {
    const index = lowerText.indexOf(lowerNeedle, from);
    if (index < 0) {
      parts.push({ text: text.slice(from), match: false });
      break;
    }
    if (index > from) parts.push({ text: text.slice(from, index), match: false });
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    from = index + needle.length;
  }
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${index}:${part.text}`}>
          {part.match ? <mark className="tree-filter-highlight">{part.text}</mark> : part.text}
        </Fragment>
      ))}
    </>
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

export type TreeClipboard = {
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
  filter = "",
  selectedPath,
  onSelectedPathChange,
  clipboard,
  onClipboardChange,
  dirTick = 0,
  onOpenFile,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  onRenamePath,
  onMovePath,
  onDelete,
  onRemoveRoot,
  onError,
  renameRequest,
  onRenameRequestHandled,
  dropTargetDir,
}: Props) {
  const [rootExpanded, setRootExpanded] = useState(() => getTreeExpansion(rootPath).rootExpanded);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(getTreeExpansion(rootPath).expanded));
  const [cache, setCache] = useState<Map<string, api.DirEntry[]>>(new Map());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [renaming, setRenaming] = useState<RenamingState | null>(null);
  const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
  const filterQuery = filter.trim();
  const filterActive = Boolean(filterQuery);
  const tr = useCallback(
    (key: Parameters<typeof t>[1]) => t(locale, key),
    [locale],
  );
  const expandedRef = useRef(expanded);
  const cacheRef = useRef(cache);
  const treeRef = useRef<HTMLUListElement>(null);
  expandedRef.current = expanded;
  cacheRef.current = cache;

  const loadDir = useCallback(async (path: string) => {
    try {
      const entries = (await api.listDir(path)).filter(
        (entry) => !(entry.is_dir && isManagedImageAssetDir(entry.name)),
      );
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
    onSelectedPathChange(path);
  }, [onSelectedPathChange]);

  useEffect(() => {
    const saved = getTreeExpansion(rootPath);
    setExpanded(new Set(saved.expanded));
    setCache(new Map());
    setRootExpanded(saved.rootExpanded);
    setCreating(null);
    setRenaming(null);
    void loadDir(rootPath);
  }, [rootPath, loadDir]);

  useEffect(() => {
    setTreeExpansion(rootPath, { rootExpanded, expanded: [...expanded] });
  }, [rootPath, rootExpanded, expanded]);

  useEffect(() => {
    if (!selectedPath || selectedPath === rootPath || !isPathUnder(selectedPath, rootPath)) return;
    const relative = relativeToWorkspace(rootPath, selectedPath);
    if (relative === selectedPath) return;
    const folders = relative.split(/[\\/]/).slice(0, -1);
    const separator = rootPath.includes("\\") ? "\\" : "/";
    const ancestors: string[] = [];
    let parent = rootPath.replace(/[\\/]+$/, "");
    for (const folder of folders) {
      parent = `${parent}${separator}${folder}`;
      ancestors.push(parent);
    }
    setRootExpanded(true);
    setExpanded((current) => {
      const next = new Set(current);
      ancestors.forEach((path) => next.add(path));
      return next;
    });
    ancestors.forEach((path) => {
      if (!cacheRef.current.has(path)) void loadDir(path);
    });
  }, [selectedPath, rootPath, loadDir]);

  useEffect(() => {
    if (!selectedPath || !isPathUnder(selectedPath, rootPath)) return;
    const frame = requestAnimationFrame(() => {
      const active = treeRef.current?.querySelector(".tree-row.active");
      if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedPath, rootPath, expanded, cache]);

  useEffect(() => {
    if (dirTick === 0) return;
    reloadVisibleDirectories();
  }, [dirTick, reloadVisibleDirectories]);

  useEffect(() => {
    const path = renameRequest?.path;
    if (!path || !isPathUnder(path, rootPath)) return;
    const parent = dirOf(path);
    const relativeParent = relativeToWorkspace(rootPath, parent);
    const separator = rootPath.includes("\\") ? "\\" : "/";
    const ancestors: string[] = [];
    if (relativeParent !== parent && relativeParent !== ".") {
      let current = rootPath.replace(/[\\/]+$/, "");
      for (const part of relativeParent.split(/[\\/]/).filter(Boolean)) {
        current = `${current}${separator}${part}`;
        ancestors.push(current);
      }
    }
    setRootExpanded(true);
    setExpanded((value) => {
      const next = new Set(value);
      ancestors.forEach((ancestor) => next.add(ancestor));
      return next;
    });
    void loadDir(parent).then(() => {
      onSelectedPathChange(path);
      setCreating(null);
      setRenaming({
        path,
        isDir: false,
        depth: relativeToWorkspace(rootPath, path).split(/[\\/]/).length,
      });
      onRenameRequestHandled?.(renameRequest.id);
    });
  }, [renameRequest, rootPath, loadDir, onSelectedPathChange, onRenameRequestHandled]);

  useEffect(() => {
    invalidateWorkspaceFileCache();
  }, [dirTick, rootPath]);

  useEffect(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      setFilteredPaths([]);
      return;
    }
    setFilteredPaths([]);
    let cancelled = false;
    void listWorkspaceFiles([rootPath], []).then((paths) => {
      if (cancelled) return;
      setFilteredPaths(
        paths
          .filter((path) => relativeToWorkspace(rootPath, path).toLowerCase().includes(query)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [filter, rootPath, dirTick]);

  const filteredPathSet = useMemo(() => new Set(filteredPaths), [filteredPaths]);
  const filterVisibleDirs = useMemo(() => {
    const directories = new Set<string>();
    const separator = rootPath.includes("\\") ? "\\" : "/";
    const root = rootPath.replace(/[\\/]+$/, "");
    for (const path of filteredPaths) {
      const relative = relativeToWorkspace(rootPath, path);
      if (relative === path) continue;
      let current = root;
      for (const part of relative.split(/[\\/]/).slice(0, -1).filter(Boolean)) {
        current = `${current}${separator}${part}`;
        directories.add(current);
      }
    }
    return directories;
  }, [filteredPaths, rootPath]);

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
        onError?.(e);
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
      try {
        const renamed = await onRenamePath(path, name, isDir);
        if (!renamed) return;
      } catch (e) {
        onError?.(e);
        return;
      }
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
      if (selectedPath) onSelectedPathChange(remapPath(selectedPath, path, newPath));
    },
    [renaming, onRenamePath, selectedPath, onSelectedPathChange],
  );

  const handleDelete = useCallback(
    async (path: string, isDir: boolean) => {
      try {
        const deleted = await onDelete(path, isDir);
        if (!deleted) return;
      } catch (e) {
        onError?.(e);
        return;
      }
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
      if (selectedPath && isPathUnder(selectedPath, path)) onSelectedPathChange(null);
    },
    [onDelete, selectedPath, onSelectedPathChange, onError],
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
      onError?.(e);
    }
  }, [onError]);

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
      onError?.(e);
    }
  }, [onError]);

  const copyFile = useCallback((path: string) => {
    onClipboardChange({ mode: "copy", path });
  }, [onClipboardChange]);

  const cutFile = useCallback((path: string) => {
    onClipboardChange({ mode: "cut", path });
  }, [onClipboardChange]);

  const pasteInto = useCallback(
    async (destDir: string) => {
      if (!clipboard) return;
      const { mode, path } = clipboard;
      try {
        if (mode === "copy") {
          await api.copyFileToDir(path, destDir);
        } else {
          const movedPath = await api.moveFileToDir(path, destDir);
          onMovePath?.(path, movedPath);
          if (selectedPath === path) onSelectedPathChange(movedPath);
          onClipboardChange(null);
        }
        onRefresh();
      } catch (e) {
        onError?.(e);
      }
    },
    [clipboard, onMovePath, selectedPath, onSelectedPathChange, onClipboardChange, onRefresh, onError],
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
      onSelectedPathChange(path);
      setMenu({ x: e.clientX, y: e.clientY, path, isDir, depth });
    },
    [onSelectedPathChange],
  );

  const folderMenuItems = useCallback(
    (path: string, depth: number): ContextMenuItem[] => [
      {
        label: tr("tree.newFile"),
        shortcut: altShortcut("N"),
        accelerator: "n",
        onClick: () => startCreate(path, "file", depth + 1),
      },
      {
        label: tr("tree.newFolder"),
        shortcut: altShortcut("Shift+N"),
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
        shortcut: deleteShortcut(),
        accelerator: isMac ? "Backspace" : "Delete",
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
      ...(path === rootPath && onRemoveRoot
        ? [
            { separator: true, label: "", onClick: () => {} } as ContextMenuItem,
            {
              label: tr("tree.removeWorkspace"),
              onClick: () => onRemoveRoot(path),
            } as ContextMenuItem,
          ]
        : []),
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
      onRemoveRoot,
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
        shortcut: deleteShortcut(),
        accelerator: isMac ? "Backspace" : "Delete",
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

  const selectedEntry = useMemo(() => {
    if (!selectedPath) return null;
    if (selectedPath === rootPath) return { path: rootPath, isDir: true };
    for (const entries of cache.values()) {
      const entry = entries.find((item) => item.path === selectedPath);
      if (entry) return { path: entry.path, isDir: entry.is_dir };
    }
    if (filteredPaths.includes(selectedPath)) return { path: selectedPath, isDir: false };
    return null;
  }, [selectedPath, rootPath, cache, filteredPaths]);

  const depthOf = useCallback((path: string) => {
    const relative = relativeToWorkspace(rootPath, path);
    return relative === path ? 1 : relative.split(/[\\/]/).length;
  }, [rootPath]);

  const handleTreeKeyDown = useCallback((event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "F5") {
      event.preventDefault();
      onRefresh();
      return;
    }
    if (!selectedEntry) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (selectedEntry.isDir) {
        if (selectedEntry.path === rootPath) setRootExpanded((value) => !value);
        else toggle(selectedEntry.path);
      } else onOpenFile(selectedEntry.path);
    } else if (event.key === "F2" && selectedEntry.path !== rootPath) {
      event.preventDefault();
      startRename(selectedEntry.path, selectedEntry.isDir, depthOf(selectedEntry.path));
    } else if ((event.key === "Delete" || (isMac && event.key === "Backspace")) && selectedEntry.path !== rootPath) {
      event.preventDefault();
      handleDelete(selectedEntry.path, selectedEntry.isDir);
    } else if (event.altKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      const parent = selectedEntry.isDir ? selectedEntry.path : dirOf(selectedEntry.path);
      startCreate(parent, event.shiftKey ? "folder" : "file", depthOf(parent) + 1);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      const parent = selectedEntry.isDir ? selectedEntry.path : dirOf(selectedEntry.path);
      void pasteInto(parent);
    }
  }, [selectedEntry, rootPath, onRefresh, onOpenFile, toggle, startRename, depthOf, handleDelete, startCreate, pasteInto]);

  const renderDir = (path: string, depth: number) => {
    const entries = cache.get(path);
    if (!entries) {
      void loadDir(path);
      return null;
    }

    return entries.map((entry) => {
      const pad = 4 + depth * 12;
      if (entry.is_dir) {
        if (filterActive && !filterVisibleDirs.has(entry.path)) return null;
        const open = filterActive ? true : expanded.has(entry.path);
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
                dropTargetDir === entry.path ? "tree-drop-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ paddingLeft: pad }}
              data-tree-drop-dir={entry.path}
              onClick={() => {
                if (isRenaming) return;
                selectNode(entry.path);
              }}
              onDoubleClick={(event) => {
                if (isRenaming || (event.target as HTMLElement).closest("button,input")) return;
                if (!filterActive) toggle(entry.path);
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
                      if (!filterActive) toggle(entry.path);
                    }}
                  >
                    <TreeChevron expanded={open} />
                  </button>
                  <span className="file-name">
                    <HighlightedTreeName text={entry.name} query={filterQuery} />
                  </span>
                </>
              )}
            </div>
            {open && (
              <ul className="file-list tree-children" data-tree-drop-dir={entry.path}>
                {creating?.parentDir === entry.path && renderInlineCreate(creating)}
                {renderDir(entry.path, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      const isMd = /\.(md|markdown|txt)$/i.test(entry.name);
      if (!isMd) return null;

      if (filterActive && !filteredPathSet.has(entry.path)) return null;

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
              <span className="file-name">
                <HighlightedTreeName text={entry.name} query={filterQuery} />
              </span>
            </>
          )}
        </li>
      );
    });
  };

  const workspaceName = basename(rootPath);
  const rootOpen = filterActive ? true : rootExpanded;
  const rootSelected = selectedPath === rootPath;

  return (
    <>
      <ul
        ref={treeRef}
        className="file-list file-tree"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        data-tree-drop-dir={rootPath}
      >
        <li className="tree-group tree-root">
          <div
            className={[
              "file-item",
              "tree-row",
              "tree-root-row",
              rootSelected ? "active" : "",
              dropTargetDir === rootPath ? "tree-drop-target" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ paddingLeft: 4 }}
            data-tree-drop-dir={rootPath}
            onClick={() => selectNode(rootPath)}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest("button,input")) return;
              if (!filterActive) setRootExpanded((value) => !value);
            }}
            onContextMenu={(e) => openContextMenu(e, rootPath, true, 0)}
          >
            <button
              type="button"
              className="tree-chevron-btn"
              aria-label={rootOpen ? tr("tree.collapseWorkspace") : tr("tree.expandWorkspace")}
              onClick={(e) => {
                e.stopPropagation();
                if (!filterActive) setRootExpanded((v) => !v);
              }}
            >
              <TreeChevron expanded={rootOpen} />
            </button>
            <span className="file-name workspace-name" title={rootPath}>
              <HighlightedTreeName text={workspaceName} query={filterQuery} />
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
            <ul className="file-list tree-children" data-tree-drop-dir={rootPath}>
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
