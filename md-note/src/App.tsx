import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Editor, { type EditorRef } from "./components/Editor";
import Titlebar from "./components/Titlebar";
import Sidebar, { type SidebarTab } from "./components/Sidebar";
import { SidebarPanel } from "./components/SidebarPanel";
import StatusBar from "./components/StatusBar";
import Settings from "./components/Settings";
import ReloadDialog from "./components/ReloadDialog";
import TableSizePicker from "./components/TableSizePicker";
import Toast from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import LinkInsertDialog from "./components/LinkInsertDialog";
import ImageInsertDialog from "./components/ImageInsertDialog";
import ShortcutsDialog from "./components/ShortcutsDialog";
import AboutDialog from "./components/AboutDialog";
import WelcomePanel from "./components/WelcomePanel";
import GlobalSearchDialog from "./components/GlobalSearchDialog";
import QuickOpenDialog from "./components/QuickOpenDialog";
import PromptDialog from "./components/PromptDialog";
import * as api from "./lib/tauri";
import { initPlatform } from "./lib/platform";
import { setConfirmHandler } from "./lib/confirmBridge";
import { setEditorBridge, type PromptRequest } from "./lib/editorBridge";
import { addRecentFile, clearRecentFiles, getRecentFiles, removeRecentFile, trimRecentFiles } from "./lib/recent";
import {
  getLastFolder,
  setLastFolder,
  clearLastFolder,
  getLastFile,
  setLastFile,
  getSidebarTab,
  setSidebarTab as persistSidebarTab,
  type SavedSidebarTab,
} from "./lib/workspace";
import { apply as applyTheme, getThemePref, resolveTheme, setThemePref, type ThemePref } from "./lib/theme";
import {
  applyMarkdownTheme,
  getMarkdownTheme,
  setMarkdownTheme,
  type MarkdownTheme,
} from "./lib/markdownTheme";
import { getLocale, setLocale, t, type Locale } from "./lib/i18n";
import {
  applyEditorLayoutPrefs,
  getConfirmDelete,
  getConfirmDiscard,
  getDefaultEditorMode,
  getDefaultSidebarTab,
  getEditorWidthPreset,
  getFocusMaxWidth,
  getFontSize,
  getLineHeight,
  getLineNumbers,
  getRecentFilesLimit,
  getRestoreLastFolder,
  getRestoreLastFile,
  getEditorZoom,
  setEditorZoom as persistEditorZoom,
  getFontFamily,
  setFontFamily as persistFontFamily,
  getMonoFontFamily,
  setMonoFontFamily as persistMonoFontFamily,
  setRestoreLastFile as persistRestoreLastFile,
  getShowStatusBar,
  getSidebarVisiblePref,
  getSpellCheck,
  getTabSize,
  getTypewriterPadding,
  getWordWrap,
  setConfirmDelete as persistConfirmDelete,
  setConfirmDiscard as persistConfirmDiscard,
  setDefaultEditorMode,
  setDefaultSidebarTab,
  setEditorWidthPreset as persistEditorWidthPreset,
  setFocusMaxWidth as persistFocusMaxWidth,
  setFontSize as persistFontSize,
  setLineHeight as persistLineHeight,
  setLineNumbers as persistLineNumbers,
  setRecentFilesLimit as persistRecentFilesLimit,
  setRestoreLastFolder as persistRestoreLastFolder,
  setShowStatusBar as persistShowStatusBar,
  setSidebarVisiblePref,
  setSidebarWidth as persistSidebarWidth,
  getSidebarWidth,
  setSpellCheck as persistSpellCheck,
  setTabSize as persistTabSize,
  setTypewriterPadding as persistTypewriterPadding,
  setWordWrap as persistWordWrap,
  type DefaultEditorMode,
  type EditorWidthPreset,
} from "./lib/preferences";
import { markdownToHtml } from "./render/export";
import { parseFrontMatter, updateFrontMatter, frontMatterLineCount } from "./lib/frontmatter";
import { dirOf, joinPath, basename, relativePath } from "./lib/paths";
import { useTabsStore } from "./store/useTabsStore";
import type { EditorAction } from "./editor";
import { setTableInsertRequestHandler } from "./editor/tableInsertBridge";
import { useToast } from "./lib/useToast";
import { countWords, estimateReadMinutes } from "./lib/wordCount";
import { commitPendingImages, preparePendingImages } from "./lib/pendingImages";
import {
  clearSessionRecovery,
  getSessionRecovery,
  stashSessionRecovery,
  type SessionRecoverySnapshot,
} from "./lib/sessionRecovery";

export default function App() {
  const editorRef = useRef<EditorRef>(null);
  const scrollAfterLoadRef = useRef<number | null>(null);
  const closedDocRef = useRef<{
    path: string | null;
    content: string;
    diskContent: string;
    dirty: boolean;
  } | null>(null);
  const { message: toastMessage, toastKind, show, showSuccess, showError } = useToast();
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const linkResolveRef = useRef<((v: { text: string; url: string } | null) => void) | null>(null);
  const imageResolveRef = useRef<((v: { alt: string; path: string } | null) => void) | null>(null);
  const promptResolveRef = useRef<((v: string | null) => void) | null>(null);
  const {
    tabs,
    activeId,
    focusMode,
    typewriterMode,
    openTab,
    newTab,
    closeTab,
    restoreTab,
    updateContent,
    setMode,
    markSaved,
    loadFromDisk,
    setPath,
    getActive,
    toggleFocusMode,
    toggleTypewriterMode,
  } = useTabsStore();

  const active = getActive();
  const activeTabId = active?.id ?? activeId;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(getSidebarTab);
  const [sidebarVisible, setSidebarVisible] = useState(getSidebarVisiblePref);
  const sidebarVisibleRef = useRef(sidebarVisible);
  const skipSidebarPreferenceWriteRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [dirTick, setDirTick] = useState(0);
  const [recentFiles, setRecentFiles] = useState(getRecentFiles);
  const [reloadPrompt, setReloadPrompt] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [linkDialogText, setLinkDialogText] = useState<string | null>(null);
  const [imageDialogAlt, setImageDialogAlt] = useState<string | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [sessionRecovery, setSessionRecovery] = useState<SessionRecoverySnapshot | null>(() => {
    const recovery = getSessionRecovery();
    return recovery?.dirty ? recovery : null;
  });
  const [dragOver, setDragOver] = useState(false);
  const [canReopenClosed, setCanReopenClosed] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [viewportRange, setViewportRange] = useState({ from: 1, to: 1 });
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [markdownTheme, setMarkdownThemeState] = useState<MarkdownTheme>(getMarkdownTheme);
  const [fontSize, setFontSize] = useState(getFontSize);
  const [lineHeight, setLineHeight] = useState(getLineHeight);
  const [editorWidthPreset, setEditorWidthPreset] = useState<EditorWidthPreset>(getEditorWidthPreset);
  const [focusMaxWidth, setFocusMaxWidth] = useState(getFocusMaxWidth);
  const [restoreLastFolder, setRestoreLastFolder] = useState(getRestoreLastFolder);
  const [restoreLastFile, setRestoreLastFile] = useState(getRestoreLastFile);
  const [fontFamily, setFontFamilyState] = useState(getFontFamily);
  const [monoFontFamily, setMonoFontFamilyState] = useState(getMonoFontFamily);
  const [editorZoom, setEditorZoomState] = useState(getEditorZoom);
  const [confirmDiscard, setConfirmDiscard] = useState(getConfirmDiscard);
  const [confirmDelete, setConfirmDelete] = useState(getConfirmDelete);
  const [recentFilesLimit, setRecentFilesLimit] = useState(getRecentFilesLimit);
  const [defaultSidebarTab, setDefaultSidebarTabState] = useState<SavedSidebarTab>(getDefaultSidebarTab);
  const [defaultEditorMode, setDefaultEditorModeState] = useState<DefaultEditorMode>(getDefaultEditorMode);
  const [lineNumbers, setLineNumbers] = useState(getLineNumbers);
  const [wordWrap, setWordWrap] = useState(getWordWrap);
  const [tabSize, setTabSize] = useState(getTabSize);
  const [spellCheck, setSpellCheck] = useState(getSpellCheck);

  const hideSidebarForExternalOpen = useCallback(() => {
    if (!sidebarVisibleRef.current) return;
    skipSidebarPreferenceWriteRef.current = true;
    setSidebarVisible(false);
  }, []);
  const [typewriterPadding, setTypewriterPadding] = useState(getTypewriterPadding);
  const [showStatusBar, setShowStatusBar] = useState(getShowStatusBar);

  const fileName = useMemo(() => {
    if (!active?.path) return t(locale, "title.untitled");
    return active.path.split(/[\\/]/).pop() || active.path;
  }, [active?.path, locale]);

  const setTitle = useCallback((path: string | null) => {
    const name = path
      ? path.split(/[\\/]/).pop() || path
      : t(locale, "title.untitled");
    getCurrentWindow().setTitle(`${name} — 墨笺 InkNote`);
  }, [locale]);

  const askConfirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmMessage(message);
    });
  }, []);

  const resolveConfirm = useCallback((ok: boolean) => {
    confirmResolveRef.current?.(ok);
    confirmResolveRef.current = null;
    setConfirmMessage(null);
  }, []);

  const confirmDiscardIfNeeded = useCallback(async () => {
    const tab = getActive();
    if (!tab?.dirty) return true;
    if (!confirmDiscard) return true;
    return askConfirm(t(locale, "confirm.discard"));
  }, [getActive, confirmDiscard, locale, askConfirm]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!(await confirmDiscardIfNeeded())) return;
      try {
        const text = await api.readFile(path);
        openTab(path, text);
        addRecentFile(path);
        setRecentFiles(getRecentFiles());
        setTitle(path);
        setLastFile(path);
        await api.watchFile(path);
      } catch (e) {
        removeRecentFile(path);
        setRecentFiles(getRecentFiles());
        showError(e);
      }
    },
    [openTab, setTitle, confirmDiscardIfNeeded, showError],
  );

  const openFileAtLine = useCallback(
    async (path: string, line: number) => {
      const tab = getActive();
      if (tab?.path === path) {
        requestAnimationFrame(() => editorRef.current?.scrollToLine(line));
        return;
      }
      scrollAfterLoadRef.current = line;
      await loadFile(path);
    },
    [getActive, loadFile],
  );

  const openFile = useCallback(async () => {
    // 不在这里问「是否放弃更改」：loadFile 里已经会问，否则会连问两次
    const p = await api.openFileDialog();
    if (p) await loadFile(p);
  }, [loadFile]);

  const openFolder = useCallback(async () => {
    const p = await api.openFolderDialog();
    if (!p) return;
    setFolderPath(p);
    setLastFolder(p);
    setSidebarVisible(true);
    setSidebarTab("files");
    persistSidebarTab("files");
  }, []);

  const saveTab = useCallback(
    async (tabId?: string): Promise<string | null> => {
      const tab = tabId ? tabs.find((t) => t.id === tabId) : getActive();
      if (!tab) return null;
      let path = tab.path;
      if (!path) {
        path = await api.saveFileDialog();
        if (!path) return null;
      }
      try {
        // 先把未落盘的粘贴图片写出去，再写文档 —— 顺序反了会先触发一次
        // 「图片文件不存在」的重建
        const preparedImages = await preparePendingImages(path);
        await api.writeFile(path, tab.content);
        commitPendingImages(preparedImages);
        markSaved(tab.id, path, tab.content);
        addRecentFile(path);
        setRecentFiles(getRecentFiles());
        setTitle(path);
        setLastFile(path);
        clearSessionRecovery();
        await api.watchFile(path);
        showSuccess(t(locale, "toast.saved"));
        return path;
      } catch (e) {
        showError(e);
        return null;
      }
    },
    [tabs, getActive, markSaved, setTitle, showError, showSuccess, locale],
  );

  const saveAs = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const p = await api.saveFileDialog(tab.path ?? undefined);
    if (!p) return;
    try {
      const preparedImages = await preparePendingImages(p);
      await api.writeFile(p, tab.content);
      commitPendingImages(preparedImages);
      markSaved(tab.id, p, tab.content);
      addRecentFile(p);
      setRecentFiles(getRecentFiles());
      setTitle(p);
      setLastFile(p);
      clearSessionRecovery();
      await api.watchFile(p);
      showSuccess(t(locale, "toast.saved"));
    } catch (e) {
      showError(e);
    }
  }, [getActive, markSaved, setTitle, showError, showSuccess, locale]);

  const exportHtml = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const path = await api.saveHtmlDialog();
    if (!path) return;
    try {
      const html = await markdownToHtml(tab.content, resolveTheme(), locale, tab.path, true, markdownTheme);
      await api.writeFile(path, html);
      showSuccess(t(locale, "toast.exported"));
    } catch (e) {
      showError(e);
    }
  }, [getActive, showError, showSuccess, locale, markdownTheme]);

  const exportPdf = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const sourceName = tab.path ? basename(tab.path) : "document.md";
    const defaultPath = sourceName.replace(/\.(?:md|markdown|txt)$/i, "") + ".pdf";
    const path = await api.savePdfDialog(defaultPath);
    if (!path) return;
    try {
      const html = await markdownToHtml(tab.content, resolveTheme(), locale, tab.path, true, markdownTheme);
      await api.exportPdf(path, html);
      showSuccess(t(locale, "toast.exported"));
    } catch (e) {
      showError(e);
    }
  }, [getActive, locale, markdownTheme, showError, showSuccess]);

  const handleNewFile = useCallback(async () => {
    if (!(await confirmDiscardIfNeeded())) return;
    newTab();
    setTitle(null);
  }, [newTab, setTitle, confirmDiscardIfNeeded]);

  const handleCloseFile = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    if (tab.dirty && confirmDiscard) {
      const ok = await askConfirm(t(locale, "confirm.close"));
      if (!ok) return;
    }
    if (tab.path || tab.content.trim()) {
      closedDocRef.current = {
        path: tab.path,
        content: tab.content,
        diskContent: tab.diskContent,
        dirty: tab.dirty,
      };
      setCanReopenClosed(true);
    }
    closeTab(tab.id);
    setTitle(null);
  }, [getActive, closeTab, setTitle, confirmDiscard, locale, askConfirm]);

  const handleReopenClosed = useCallback(async () => {
    const snap = closedDocRef.current;
    if (!snap) {
      show(t(locale, "toast.nothingToReopen"));
      return;
    }
    if (!(await confirmDiscardIfNeeded())) return;
    restoreTab(snap);
    closedDocRef.current = null;
    setCanReopenClosed(false);
    setTitle(snap.path);
    if (snap.path) {
      try {
        await api.watchFile(snap.path);
      } catch (e) {
        showError(e);
      }
    } else {
      api.unwatchFile();
    }
    show(t(locale, "toast.reopened"));
  }, [confirmDiscardIfNeeded, restoreTab, setTitle, show, showError, locale]);

  const handleSessionRecovery = useCallback(() => {
    const snap = sessionRecovery;
    if (!snap) return;
    restoreTab({
      path: snap.path,
      content: snap.content,
      diskContent: snap.diskContent,
      dirty: snap.dirty,
    });
    clearSessionRecovery();
    setSessionRecovery(null);
    setTitle(snap.path);
    show(t(locale, "toast.recoveryRestored"));
  }, [sessionRecovery, restoreTab, setTitle, show, locale]);

  const handleRenamePath = useCallback(
    async (path: string, newName: string, _isDir: boolean) => {
      const base = basename(path);
      if (!newName || newName === base) return;
      const parent = dirOf(path);
      const newPath = joinPath(parent, newName);
      try {
        await api.renamePath(path, newPath);
        // 只换路径：重命名不该把「未保存」状态抹掉
        if (active?.path === path) {
          setPath(active.id, newPath);
        } else if (active?.path?.startsWith(path + (path.includes("\\") ? "\\" : "/"))) {
          const sep = path.includes("\\") ? "\\" : "/";
          const rel = active.path.slice(path.length + 1);
          setPath(active.id, `${newPath}${sep}${rel}`);
        }
        setDirTick((t) => t + 1);
        setRecentFiles(getRecentFiles());
      } catch (e) {
        showError(e);
      }
    },
    [active, setPath, showError],
  );

  const handleDeletePath = useCallback(
    async (path: string, isDir: boolean) => {
      const name = basename(path);
      if (confirmDelete) {
        const msg = isDir
          ? t(locale, "confirm.deleteFolder", { name })
          : t(locale, "confirm.deleteFile", { name });
        const ok = await askConfirm(msg);
        if (!ok) return;
      }
      try {
        await api.removePath(path);
        const sep = path.includes("\\") ? "\\" : "/";
        if (active?.path === path || (isDir && active?.path?.startsWith(path + sep))) {
          handleNewFile();
        }
        setDirTick((t) => t + 1);
        setRecentFiles(getRecentFiles());
      } catch (e) {
        showError(e);
      }
    },
    [active, handleNewFile, confirmDelete, locale, showError, askConfirm],
  );

  const handleCreateFileInFolder = useCallback(
    async (parentDir: string, name: string) => {
      const path = joinPath(parentDir, name);
      try {
        await api.createFile(path, "");
        setDirTick((t) => t + 1);
        await loadFile(path);
      } catch (e) {
        showError(e);
      }
    },
    [loadFile, showError],
  );

  const handleCreateFolderInDir = useCallback(
    async (parentDir: string, name: string) => {
      const path = joinPath(parentDir, name);
      try {
        await api.createDir(path);
        setDirTick((t) => t + 1);
      } catch (e) {
        showError(e);
      }
    },
    [showError],
  );

  const frontMatterData = useMemo(() => {
    if (!active?.content) return {};
    return parseFrontMatter(active.content)?.data ?? {};
  }, [active?.content]);

  const handleFrontMatter = useCallback(
    (data: Record<string, string>) => {
      if (!activeTabId || !active) return;
      const next = updateFrontMatter(active.content, data);
      updateContent(activeTabId, next);
    },
    [activeTabId, active, updateContent],
  );

  const handleChange = useCallback(
    (doc: string) => {
      if (activeTabId) updateContent(activeTabId, doc);
    },
    [activeTabId, updateContent],
  );

  const handleModeChange = useCallback(
    (mode: "preview" | "source") => {
      if (activeTabId) setMode(activeTabId, mode);
    },
    [activeTabId, setMode],
  );

  const toggleEditorMode = useCallback(() => {
    const tab = getActive();
    if (!tab || !activeTabId) return;
    setMode(activeTabId, tab.mode === "preview" ? "source" : "preview");
  }, [getActive, activeTabId, setMode]);

  const handleSidebarTab = useCallback((tab: SidebarTab) => {
    if (focusMode) toggleFocusMode();
    setSidebarVisible(true);
    setSidebarTab(tab);
    persistSidebarTab(tab);
  }, [focusMode, toggleFocusMode]);

  const handleRemoveRecent = useCallback((path: string) => {
    removeRecentFile(path);
    setRecentFiles(getRecentFiles());
  }, []);

  const runEditorAction = useCallback((action: EditorAction) => {
    editorRef.current?.runAction(action);
  }, []);

  useEffect(() => {
    setTableInsertRequestHandler(() => setTablePickerOpen(true));
    return () => setTableInsertRequestHandler(null);
  }, []);

  const handleTableSizeSelect = useCallback((rows: number, cols: number) => {
    editorRef.current?.insertTable(rows, cols);
    setTablePickerOpen(false);
  }, []);

  const handleExternalChange = useCallback(async () => {
    const tab = getActive();
    if (!tab?.path) return;
    try {
      const disk = await api.readFile(tab.path);
      if (disk === tab.content || disk === tab.diskContent) return;
      // 磁盘上就是当前基线或仍在进行的应用写入：不是外部修改
      if (api.isSelfWritePending(tab.path, disk)) return;
      if (tab.dirty) {
        setReloadPrompt(true);
      } else {
        loadFromDisk(tab.id, tab.path, disk);
        show(t(locale, "toast.externalReload"));
      }
    } catch {
      /* ignore */
    }
  }, [getActive, loadFromDisk, show, locale]);

  const reloadFromDisk = useCallback(async () => {
    const tab = getActive();
    if (!tab?.path) return;
    const disk = await api.readFile(tab.path);
    loadFromDisk(tab.id, tab.path, disk);
    setReloadPrompt(false);
    show(t(locale, "toast.reloaded"));
  }, [getActive, loadFromDisk, show, locale]);

  const handleOpenSample = useCallback(async () => {
    if (!(await confirmDiscardIfNeeded())) return;
    try {
      const res = await fetch("/sample.md");
      const text = await res.text();
      newTab();
      const tab = getActive();
      if (tab) updateContent(tab.id, text);
      setTitle(null);
    } catch (e) {
      showError(e);
    }
  }, [confirmDiscardIfNeeded, newTab, getActive, updateContent, setTitle, showError]);

  const handleDroppedMarkdown = useCallback(
    async (content: string, path?: string) => {
      if (path) {
        await loadFile(path);
        return;
      }
      if (!(await confirmDiscardIfNeeded())) return;
      newTab();
      const tab = getActive();
      if (tab) updateContent(tab.id, content);
      setTitle(null);
    },
    [loadFile, confirmDiscardIfNeeded, newTab, getActive, updateContent, setTitle],
  );

  const handleToggleFocus = useCallback(() => {
    const next = !focusMode;
    toggleFocusMode();
    if (next) show(t(locale, "toast.focusHint"));
  }, [focusMode, toggleFocusMode, show, locale]);

  const handleToggleTypewriter = useCallback(() => {
    const next = !typewriterMode;
    toggleTypewriterMode();
    if (next) show(t(locale, "toast.typewriterHint"));
  }, [typewriterMode, toggleTypewriterMode, show, locale]);

  // 初始化 effect 里用到的回调放进 ref：直接进依赖数组的话，saveTab 依赖 tabs，
  // 每敲一个字符整个 effect 就会重挂一次（重复注册监听、关掉文件监听、重载文件）
  const bootRef = useRef({
    loadFile,
    openFile,
    saveTab,
    saveAs,
    exportHtml,
    exportPdf,
    handleExternalChange,
    handleToggleFocus,
    handleToggleTypewriter,
  });
  bootRef.current = {
    loadFile,
    openFile,
    saveTab,
    saveAs,
    exportHtml,
    exportPdf,
    handleExternalChange,
    handleToggleFocus,
    handleToggleTypewriter,
  };

  useEffect(() => {
    initPlatform();
    applyTheme();
    applyMarkdownTheme();
    applyEditorLayoutPrefs();
    let disposed = false;
    const un: Array<() => void> = [];
    const track = (p: Promise<() => void>) => {
      void p.then((f) => {
        // 清理可能早于 listen 解析完成，这里补一次
        if (disposed) f();
        else un.push(f);
      });
    };

    track(api.onOpenFile((p) => {
      if (!disposed) {
        hideSidebarForExternalOpen();
        void bootRef.current.loadFile(p);
      }
    }));
    track(api.onFileChanged(() => { if (!disposed) void bootRef.current.handleExternalChange(); }));
    track(api.onMenu((action) => {
      if (disposed) return;
      const b = bootRef.current;
      switch (action) {
        case "settings": setSettingsOpen(true); break;
        case "open": void b.openFile(); break;
        case "save": void b.saveTab(); break;
        case "save-as": void b.saveAs(); break;
        case "export-html": void b.exportHtml(); break;
        case "export-pdf": void b.exportPdf(); break;
        case "toggle-sidebar": setSidebarVisible((v) => !v); break;
        case "focus-mode": b.handleToggleFocus(); break;
        case "typewriter-mode": b.handleToggleTypewriter(); break;
      }
    }));
    api.getStartupFile().then((p) => {
      if (disposed) return;
      if (p) {
        hideSidebarForExternalOpen();
        void bootRef.current.loadFile(p);
        return;
      }
      if (getRestoreLastFolder()) {
        const savedFolder = getLastFolder();
        if (savedFolder) {
          api
            .listDir(savedFolder)
            .then(() => {
              if (!disposed) {
                setFolderPath(savedFolder);
              }
            })
            .catch(() => clearLastFolder());
        }
      }
      if (getRestoreLastFile()) {
        const last = getLastFile();
        if (last) void bootRef.current.loadFile(last);
      }
    });

    return () => {
      disposed = true;
      un.forEach((f) => f());
      api.unwatchFile();
    };
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setConfirmHandler((msg) => askConfirm(msg));
    return () => setConfirmHandler(null);
  }, [askConfirm]);

  useEffect(() => {
    setEditorBridge({
      confirm: (msg) => askConfirm(msg),
      prompt: (req) =>
        new Promise((resolve) => {
          promptResolveRef.current = resolve;
          setPromptDialog(req);
        }),
      pickLink: (defaultText) =>
        new Promise((resolve) => {
          linkResolveRef.current = resolve;
          setLinkDialogText(defaultText);
        }),
      pickImage: (defaultAlt) =>
        new Promise((resolve) => {
          imageResolveRef.current = resolve;
          setImageDialogAlt(defaultAlt);
        }),
      requestSave: () => saveTab(),
      showError,
      showMessage: (msg) => show(msg),
    });
    return () => setEditorBridge(null);
  }, [askConfirm, saveTab, showError, show]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onDragDropEvent(({ payload }) => {
      if (disposed) return;
      if (payload.type === "enter") {
        setDragOver(payload.paths.some((path) => /\.(md|markdown|txt)$/i.test(path)));
      } else if (payload.type === "leave") {
        setDragOver(false);
      } else if (payload.type === "drop") {
        setDragOver(false);
        const path = payload.paths.find((candidate) => /\.(md|markdown|txt)$/i.test(candidate));
        if (path) void loadFile(path);
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadFile]);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.onCloseRequested(async (event) => {
      const tab = getActive();
      if (!tab?.dirty) {
        clearSessionRecovery();
        return;
      }
      if (!tab.path) {
        stashSessionRecovery({
          path: null,
          content: tab.content,
          diskContent: tab.diskContent,
          dirty: true,
          time: Date.now(),
        });
        return;
      }

      event.preventDefault();
      try {
        const preparedImages = await preparePendingImages(tab.path);
        await api.writeFile(tab.path, tab.content);
        commitPendingImages(preparedImages);
        markSaved(tab.id, tab.path, tab.content);
        clearSessionRecovery();
        await win.destroy();
      } catch (error) {
        showError(error);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [getActive, markSaved, showError]);

  useEffect(() => {
    const modalOpen =
      settingsOpen ||
      reloadPrompt ||
      tablePickerOpen ||
      confirmMessage ||
      linkDialogText !== null ||
      imageDialogAlt !== null ||
      promptDialog ||
      shortcutsOpen ||
      aboutOpen ||
      globalSearchOpen ||
      quickOpenOpen ||
      sessionRecovery !== null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F8") {
        e.preventDefault();
        handleToggleFocus();
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        handleToggleTypewriter();
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        void getCurrentWindow().isFullscreen().then((fs) => getCurrentWindow().setFullscreen(!fs));
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (modalOpen) return;
      const k = e.key.toLowerCase();
      if (k === "p" && !e.shiftKey) {
        e.preventDefault();
        setQuickOpenOpen(true);
      } else if (k === "l" && e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (k === "/" || e.key === "?") {
        e.preventDefault();
        toggleEditorMode();
      } else if (k === "f" && e.shiftKey) {
        e.preventDefault();
        setGlobalSearchOpen(true);
      } else if (k === "t" && e.shiftKey) {
        e.preventDefault();
        void handleReopenClosed();
      } else if (k === "s" && e.shiftKey) { e.preventDefault(); saveAs(); }
      else if (k === "s") { e.preventDefault(); saveTab(); }
      else if (k === "o") { e.preventDefault(); openFile(); }
      else if (k === "n") { e.preventDefault(); handleNewFile(); }
      else if (k === "w") { e.preventDefault(); handleCloseFile(); }
      else if (k === "=" || k === "+") {
        e.preventDefault();
        const next = Math.min(150, getEditorZoom() + 10);
        persistEditorZoom(next);
        setEditorZoomState(next);
        applyEditorLayoutPrefs();
      } else if (k === "-") {
        e.preventDefault();
        const next = Math.max(80, getEditorZoom() - 10);
        persistEditorZoom(next);
        setEditorZoomState(next);
        applyEditorLayoutPrefs();
      } else if (k === ",") { e.preventDefault(); setSettingsOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    saveTab,
    saveAs,
    openFile,
    handleNewFile,
    handleCloseFile,
    handleReopenClosed,
    handleToggleFocus,
    handleToggleTypewriter,
    toggleEditorMode,
    settingsOpen,
    reloadPrompt,
    tablePickerOpen,
    confirmMessage,
    linkDialogText,
    imageDialogAlt,
    promptDialog,
    shortcutsOpen,
    aboutOpen,
    globalSearchOpen,
    quickOpenOpen,
    sessionRecovery,
  ]);

  useEffect(() => {
    if (sessionRecovery) return;
    const tab = getActive();
    if (!tab?.dirty) {
      clearSessionRecovery();
      return;
    }
    const timer = setTimeout(() => {
      stashSessionRecovery({
        path: tab.path,
        content: tab.content,
        diskContent: tab.diskContent,
        dirty: tab.dirty,
        time: Date.now(),
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [tabs, getActive, sessionRecovery]);

  useEffect(() => {
    if (!folderPath) {
      api.unwatchDir().catch(() => {});
      return;
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;

    api.watchDir(folderPath).catch(showError);
    api.onDirChanged(() => {
      if (!disposed) setDirTick((t) => t + 1);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
      api.unwatchDir().catch(() => {});
    };
  }, [folderPath, showError]);

  useEffect(() => {
    persistFontSize(fontSize);
    persistLineHeight(lineHeight);
    persistEditorWidthPreset(editorWidthPreset);
    persistFocusMaxWidth(focusMaxWidth);
    persistTypewriterPadding(typewriterPadding);
    applyEditorLayoutPrefs();
  }, [fontSize, lineHeight, editorWidthPreset, focusMaxWidth, typewriterPadding]);

  useEffect(() => {
    persistRestoreLastFolder(restoreLastFolder);
  }, [restoreLastFolder]);

  useEffect(() => {
    persistRestoreLastFile(restoreLastFile);
  }, [restoreLastFile]);

  useEffect(() => {
    persistFontFamily(fontFamily);
    applyEditorLayoutPrefs();
  }, [fontFamily]);

  useEffect(() => {
    persistMonoFontFamily(monoFontFamily);
    applyEditorLayoutPrefs();
  }, [monoFontFamily]);

  useEffect(() => {
    persistEditorZoom(editorZoom);
    applyEditorLayoutPrefs();
  }, [editorZoom]);

  useEffect(() => {
    persistConfirmDiscard(confirmDiscard);
  }, [confirmDiscard]);

  useEffect(() => {
    persistConfirmDelete(confirmDelete);
  }, [confirmDelete]);

  useEffect(() => {
    persistRecentFilesLimit(recentFilesLimit);
    trimRecentFiles(recentFilesLimit);
    setRecentFiles(getRecentFiles());
  }, [recentFilesLimit]);

  useEffect(() => {
    sidebarVisibleRef.current = sidebarVisible;
    if (skipSidebarPreferenceWriteRef.current) {
      skipSidebarPreferenceWriteRef.current = false;
      return;
    }
    setSidebarVisiblePref(sidebarVisible);
  }, [sidebarVisible]);

  useEffect(() => {
    persistSidebarWidth(sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    persistLineNumbers(lineNumbers);
  }, [lineNumbers]);

  useEffect(() => {
    persistWordWrap(wordWrap);
  }, [wordWrap]);

  useEffect(() => {
    persistTabSize(tabSize);
  }, [tabSize]);

  useEffect(() => {
    persistSpellCheck(spellCheck);
  }, [spellCheck]);

  useEffect(() => {
    persistShowStatusBar(showStatusBar);
  }, [showStatusBar]);

  useEffect(() => {
    setTitle(active?.path ?? null);
    if (active?.path) api.watchFile(active.path).catch(showError);
    else api.unwatchFile();
  }, [active?.path, setTitle, showError]);

  const stats = useMemo(() => {
    const text = active?.content ?? "";
    const words = countWords(text);
    return {
      words,
      chars: text.length,
      lines: text.split("\n").length,
      readMin: estimateReadMinutes(words, locale),
    };
  }, [active?.content, locale]);

  const outline = useMemo(() => {
    const items: { level: number; text: string; line: number }[] = [];
    const content = active?.content ?? "";
    const lines = content.split("\n");
    // front matter 的最后一行 + `---` 会被当成 setext 二级标题，必须跳过
    const start = frontMatterLineCount(content);
    let inFence = false;
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const m = /^(#{1,6})\s+(.+)$/.exec(line);
      if (m) {
        items.push({ level: m[1].length, text: m[2], line: i + 1 });
        continue;
      }
      const trimmed = line.trim();
      if (!trimmed) continue;
      const next = lines[i + 1]?.trim() ?? "";
      if (/^=+\s*$/.test(next)) {
        items.push({ level: 1, text: trimmed, line: i + 1 });
      } else if (/^-+\s*$/.test(next)) {
        items.push({ level: 2, text: trimmed, line: i + 1 });
      }
    }
    return items;
  }, [active?.content]);

  const showWelcome = !active?.path && !active?.content.trim();
  const wasWelcomeRef = useRef(showWelcome);

  useEffect(() => {
    if (showWelcome) {
      wasWelcomeRef.current = true;
      return;
    }
    if (wasWelcomeRef.current) {
      wasWelcomeRef.current = false;
      requestAnimationFrame(() => {
        const host = document.querySelector(".editor-host .cm-content");
        if (host instanceof HTMLElement) host.focus();
      });
    }
  }, [showWelcome]);

  useEffect(() => {
    if (showWelcome || !active) return;
    const line = scrollAfterLoadRef.current;
    if (!line) return;
    scrollAfterLoadRef.current = null;
    requestAnimationFrame(() => {
      editorRef.current?.scrollToLine(line);
    });
  }, [showWelcome, active?.path, active?.id]);

  const activeOutlineLine = useMemo(() => {
    if (!outline.length) return null;
    const cursorVisible = cursorLine >= viewportRange.from && cursorLine <= viewportRange.to;
    const refLine = cursorVisible ? cursorLine : viewportRange.from;
    let best = outline[0].line;
    for (const h of outline) {
      if (h.line <= refLine) best = h.line;
      else break;
    }
    return best;
  }, [outline, cursorLine, viewportRange]);

  const handleCopyPath = useCallback(async () => {
    const tab = getActive();
    if (!tab?.path) return;
    try {
      await navigator.clipboard.writeText(tab.path);
      show(t(locale, "toast.pathCopied"));
    } catch (e) {
      showError(e);
    }
  }, [getActive, show, showError, locale]);

  const scrollToHeading = useCallback((line: number) => {
    editorRef.current?.scrollToLine(line);
  }, []);

  const appClass = [
    "app",
    focusMode ? "focus-mode" : "",
    typewriterMode ? "typewriter-mode" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={appClass}>
      <Titlebar
        locale={locale}
        fileName={fileName}
        dirty={active?.dirty ?? false}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        sidebarVisible={sidebarVisible}
        sidebarTab={sidebarTab}
        editorMode={active?.mode ?? "preview"}
        onOpen={openFile}
        onOpenFolder={openFolder}
        onNewFile={handleNewFile}
        onCloseFile={handleCloseFile}
        onSave={() => saveTab()}
        onSaveAs={saveAs}
        onExportHtml={exportHtml}
        onExportPdf={exportPdf}
        onEditorAction={runEditorAction}
        onToggleSidebar={() => setSidebarVisible((v) => !v)}
        onSidebarTab={handleSidebarTab}
        onSetEditorMode={handleModeChange}
        onToggleEditorMode={toggleEditorMode}
        onToggleFocus={handleToggleFocus}
        onToggleTypewriter={handleToggleTypewriter}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onGlobalSearch={() => setGlobalSearchOpen(true)}
        onQuickOpen={() => setQuickOpenOpen(true)}
        onOpenRecent={(p) => void loadFile(p)}
        onReopenClosed={() => void handleReopenClosed()}
        canReopenClosed={canReopenClosed}
        recentFiles={recentFiles}
      />
      <div className={dragOver ? "app-body drag-over" : "app-body"}>
        {sidebarVisible && !focusMode && (
          <SidebarPanel
            locale={locale}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onHide={() => setSidebarVisible(false)}
          >
            <Sidebar
              locale={locale}
              tab={sidebarTab}
              onTab={handleSidebarTab}
              folderPath={folderPath}
              dirTick={dirTick}
              onOpenPath={(p) => loadFile(p)}
              onRefreshTree={() => setDirTick((t) => t + 1)}
              onCreateFileInDir={folderPath ? handleCreateFileInFolder : undefined}
              onCreateFolderInDir={folderPath ? handleCreateFolderInDir : undefined}
              onRenamePath={folderPath ? handleRenamePath : undefined}
              onDeletePath={folderPath ? handleDeletePath : undefined}
              outline={outline}
              activeOutlineLine={activeOutlineLine}
              onOutlineClick={scrollToHeading}
              currentPath={active?.path ?? null}
              recentFiles={recentFiles}
              onRemoveRecent={handleRemoveRecent}
              onOpenFolder={() => void openFolder()}
              onError={showError}
            />
          </SidebarPanel>
        )}
        <main className="main">
          {showWelcome && (
            <WelcomePanel
              locale={locale}
              recentFiles={recentFiles}
              onNew={() => void handleNewFile()}
              onOpen={() => void openFile()}
              onOpenFolder={() => void openFolder()}
              onOpenSample={() => void handleOpenSample()}
              onOpenRecent={(p) => void loadFile(p)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {active && !showWelcome && (
            <Editor
              ref={editorRef}
              locale={locale}
              key={active.id}
              value={active.content}
              mode={active.mode}
              filePath={active.path}
              typewriter={typewriterMode}
              lineNumbers={lineNumbers}
              wordWrap={wordWrap}
              tabSize={tabSize}
              spellCheck={spellCheck}
              onChange={handleChange}
              onModeChange={handleModeChange}
              onCursorLine={setCursorLine}
              onViewportRange={(from, to) => setViewportRange({ from, to })}
              onOpenMarkdown={(content, path) => void handleDroppedMarkdown(content, path)}
            />
          )}
        </main>
      </div>
      {showStatusBar && (
        <StatusBar
          locale={locale}
          mode={active?.mode ?? "preview"}
          stats={stats}
          path={active?.path ?? null}
          dirty={active?.dirty ?? false}
          cursorLine={cursorLine}
          focusMode={focusMode}
          typewriterMode={typewriterMode}
          onCopyPath={() => void handleCopyPath()}
        />
      )}
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          values={{
            locale,
            theme,
            markdownTheme,
            restoreLastFolder,
            restoreLastFile,
            confirmDiscard,
            confirmDelete,
            recentFilesLimit,
            sidebarVisible,
            defaultSidebarTab,
            defaultEditorMode,
            fontSize,
            lineHeight,
            fontFamily,
            monoFontFamily,
            editorZoom,
            editorWidthPreset,
            focusMaxWidth,
            lineNumbers,
            wordWrap,
            tabSize,
            spellCheck,
            typewriterPadding,
            showStatusBar,
            frontMatter: frontMatterData,
          }}
          handlers={{
            onLocale: (next) => {
              setLocaleState(next);
              setLocale(next);
            },
            onTheme: (next) => {
              setTheme(next);
              setThemePref(next);
            },
            onMarkdownTheme: (next) => {
              setMarkdownThemeState(next);
              setMarkdownTheme(next);
            },
            onRestoreLastFolder: setRestoreLastFolder,
            onRestoreLastFile: setRestoreLastFile,
            onConfirmDiscard: setConfirmDiscard,
            onConfirmDelete: setConfirmDelete,
            onRecentFilesLimit: setRecentFilesLimit,
            onClearRecent: () => {
              clearRecentFiles();
              setRecentFiles([]);
            },
            onSidebarVisible: setSidebarVisible,
            onDefaultSidebarTab: (tab) => {
              setDefaultSidebarTabState(tab);
              setDefaultSidebarTab(tab);
              setSidebarTab(tab);
              persistSidebarTab(tab);
            },
            onDefaultEditorMode: (mode) => {
              setDefaultEditorModeState(mode);
              setDefaultEditorMode(mode);
            },
            onFontSize: setFontSize,
            onLineHeight: setLineHeight,
            onFontFamily: setFontFamilyState,
            onMonoFontFamily: setMonoFontFamilyState,
            onEditorZoom: setEditorZoomState,
            onEditorWidthPreset: setEditorWidthPreset,
            onFocusMaxWidth: setFocusMaxWidth,
            onLineNumbers: setLineNumbers,
            onWordWrap: setWordWrap,
            onTabSize: setTabSize,
            onSpellCheck: setSpellCheck,
            onTypewriterPadding: setTypewriterPadding,
            onShowStatusBar: setShowStatusBar,
            onFrontMatter: handleFrontMatter,
          }}
        />
      )}
      {reloadPrompt && (
        <ReloadDialog
          locale={locale}
          onReload={reloadFromDisk}
          onDismiss={() => setReloadPrompt(false)}
        />
      )}
      <TableSizePicker
        open={tablePickerOpen}
        locale={locale}
        onSelect={handleTableSizeSelect}
        onCancel={() => setTablePickerOpen(false)}
      />
      <Toast message={toastMessage} kind={toastKind} />
      {confirmMessage && (
        <ConfirmDialog
          locale={locale}
          message={confirmMessage}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
      {linkDialogText !== null && (
        <LinkInsertDialog
          locale={locale}
          defaultText={linkDialogText}
          onConfirm={(text, url) => {
            linkResolveRef.current?.({ text, url });
            linkResolveRef.current = null;
            setLinkDialogText(null);
          }}
          onCancel={() => {
            linkResolveRef.current?.(null);
            linkResolveRef.current = null;
            setLinkDialogText(null);
          }}
        />
      )}
      {imageDialogAlt !== null && (
        <ImageInsertDialog
          locale={locale}
          defaultAlt={imageDialogAlt}
          onBrowse={async () => {
            const picked = await api.openImageDialog();
            if (!picked) return null;
            const tab = getActive();
            if (tab?.path) return relativePath(dirOf(tab.path), picked);
            return picked;
          }}
          onConfirm={(alt, path) => {
            imageResolveRef.current?.({ alt, path });
            imageResolveRef.current = null;
            setImageDialogAlt(null);
          }}
          onCancel={() => {
            imageResolveRef.current?.(null);
            imageResolveRef.current = null;
            setImageDialogAlt(null);
          }}
        />
      )}
      {promptDialog && (
        <PromptDialog
          locale={locale}
          title={promptDialog.title}
          label={promptDialog.label}
          defaultValue={promptDialog.defaultValue}
          placeholder={promptDialog.placeholder}
          onConfirm={(value) => {
            promptResolveRef.current?.(value);
            promptResolveRef.current = null;
            setPromptDialog(null);
          }}
          onCancel={() => {
            promptResolveRef.current?.(null);
            promptResolveRef.current = null;
            setPromptDialog(null);
          }}
        />
      )}
      {shortcutsOpen && (
        <ShortcutsDialog locale={locale} onClose={() => setShortcutsOpen(false)} />
      )}
      {aboutOpen && (
        <AboutDialog locale={locale} onClose={() => setAboutOpen(false)} />
      )}
      {globalSearchOpen && (
        <GlobalSearchDialog
          locale={locale}
          folderPath={folderPath}
          recentFiles={recentFiles}
          onOpenResult={(path, line) => void openFileAtLine(path, line)}
          onOpenFolder={() => void openFolder()}
          onClose={() => setGlobalSearchOpen(false)}
        />
      )}
      {quickOpenOpen && (
        <QuickOpenDialog
          locale={locale}
          folderPath={folderPath}
          recentFiles={recentFiles}
          currentPath={active?.path ?? null}
          onOpen={(p) => void loadFile(p)}
          onClose={() => setQuickOpenOpen(false)}
        />
      )}
      {sessionRecovery && (
        <ConfirmDialog
          locale={locale}
          message={t(locale, "recovery.prompt")}
          onConfirm={() => handleSessionRecovery()}
          onCancel={() => {
            clearSessionRecovery();
            setSessionRecovery(null);
          }}
        />
      )}
    </div>
  );
}
