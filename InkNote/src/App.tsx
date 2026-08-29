import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { EditorRef } from "./components/Editor";
import Titlebar from "./components/Titlebar";
import Sidebar, { type SidebarTab } from "./components/Sidebar";
import { SidebarPanel } from "./components/SidebarPanel";
import StatusBar from "./components/StatusBar";
import Settings from "./components/Settings";
import ReloadDialog from "./components/ReloadDialog";
import TableSizePicker from "./components/TableSizePicker";
import Toast from "./components/Toast";
import UpdateProgress, { type UpdateProgressState } from "./components/UpdateProgress";
import ConfirmDialog from "./components/ConfirmDialog";
import LinkInsertDialog from "./components/LinkInsertDialog";
import ImageInsertDialog from "./components/ImageInsertDialog";
import ShortcutsDialog from "./components/ShortcutsDialog";
import AboutDialog from "./components/AboutDialog";
import WelcomePanel from "./components/WelcomePanel";
import GlobalSearchDialog from "./components/GlobalSearchDialog";
import QuickOpenDialog from "./components/QuickOpenDialog";
import DocumentSearchDialog from "./components/DocumentSearchDialog";
import PromptDialog from "./components/PromptDialog";
import FileConflictDialog from "./components/FileConflictDialog";
import * as api from "./lib/tauri";
import { initPlatform, isMac } from "./lib/platform";
import { setConfirmHandler } from "./lib/confirmBridge";
import { setEditorBridge, type PromptRequest } from "./lib/editorBridge";
import {
  addRecentFile,
  clearRecentFiles,
  getRecentFiles,
  remapRecentFiles,
  removeRecentFile,
  removeRecentFilesUnder,
  trimRecentFiles,
} from "./lib/recent";
import {
  clearLastFolder,
  getWorkspaceFolders,
  setWorkspaceFolders,
  getLastFile,
  clearLastFile,
  remapLastFile,
  clearLastFileUnder,
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
  getExternalOpenReadOnly,
  getNewDocumentMetadata,
  getMetadataTitle,
  getMetadataAuthor,
  setEditorZoom as persistEditorZoom,
  setExternalOpenReadOnly as persistExternalOpenReadOnly,
  setNewDocumentMetadata as persistNewDocumentMetadata,
  setMetadataTitle as persistMetadataTitle,
  setMetadataAuthor as persistMetadataAuthor,
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
import { formatFrontMatter } from "./lib/frontmatter";
import { dirOf, joinPath, basename, relativePath } from "./lib/paths";
import { useTabsStore, type TabDoc } from "./store/useTabsStore";
import type { EditorAction } from "./editor";
import { setTableInsertRequestHandler } from "./editor/tableInsertBridge";
import { useToast } from "./lib/useToast";
import { countWords, estimateReadMinutes } from "./lib/wordCount";
import { nextUpdatePercent } from "./lib/updateProgress";
import {
  clearPendingImages,
  commitPendingImages,
  pendingImageDataUrls,
  preparePendingImages,
  restorePendingImages,
  snapshotPendingImages,
  type PendingImageSnapshot,
} from "./lib/pendingImages";
import { removeTreeExpansion } from "./lib/treeState";
import { extractMarkdownOutline } from "./lib/markdownOutline";
import { NATIVE_MENU_EVENT, setupMacNativeMenu } from "./lib/nativeMenu";
import { invalidateWorkspaceFileCache } from "./lib/workspaceSearch";
import { flushSettingsStore } from "./lib/settingsStore";
import {
  cleanupRemovedManagedImages,
  prepareManagedImagesForSaveAs,
  removeDocumentWithManagedImages,
  transferDocumentWithManagedImages,
  type DocumentTransferMode,
  type FileConflictAction,
} from "./lib/documentAssets";
import { rewriteManagedImageReferences } from "./lib/imageAssets";

const Editor = lazy(() => import("./components/Editor"));

function formatLocalDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function App() {
  const editorRef = useRef<EditorRef>(null);
  const scrollAfterLoadRef = useRef<number | null>(null);
  const closedDocRef = useRef<{
    path: string | null;
    content: string;
    diskContent: string;
    dirty: boolean;
    mode: TabDoc["mode"];
    externalDocument: boolean;
    documentEditable: boolean;
    sampleDocument: boolean;
    pendingImages: PendingImageSnapshot[];
  } | null>(null);
  const { message: toastMessage, toastKind, show, showSuccess, showError } = useToast();
  const updateRunningRef = useRef(false);
  const closingRef = useRef(false);
  const fileLoadRequestRef = useRef(0);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressState | null>(null);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const linkResolveRef = useRef<((v: { text: string; url: string } | null) => void) | null>(null);
  const imageResolveRef = useRef<((v: { alt: string; path: string } | null) => void) | null>(null);
  const fileConflictResolveRef = useRef<((v: FileConflictAction | "cancel") => void) | null>(null);
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
  const dirWatchChainRef = useRef<Promise<void>>(Promise.resolve());
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [dirTick, setDirTick] = useState(0);
  const [recentFiles, setRecentFiles] = useState(getRecentFiles);
  const [reloadPrompt, setReloadPrompt] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [linkDialogText, setLinkDialogText] = useState<string | null>(null);
  const [imageDialog, setImageDialog] = useState<{ alt: string; path: string } | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [documentSearch, setDocumentSearch] = useState<{ open: boolean; replace: boolean; query: string }>({
    open: false,
    replace: false,
    query: "",
  });
  const [fileRevealRequest, setFileRevealRequest] = useState<{ path: string; id: number } | null>(null);
  const fileRevealIdRef = useRef(0);
  const [fileRenameRequest, setFileRenameRequest] = useState<{ path: string; id: number } | null>(null);
  const fileRenameIdRef = useRef(0);
  const [treeDropTarget, setTreeDropTarget] = useState<string | null>(null);
  const [importConflict, setImportConflict] = useState<{ path: string; targetDir: string } | null>(null);
  const handleRenameRequestHandled = useCallback((id: number) => {
    setFileRenameRequest((request) => request?.id === id ? null : request);
  }, []);

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
  const [externalOpenReadOnly, setExternalOpenReadOnly] = useState(getExternalOpenReadOnly);
  const [newDocumentMetadata, setNewDocumentMetadata] = useState(getNewDocumentMetadata);
  const [metadataTitle, setMetadataTitle] = useState(getMetadataTitle);
  const [metadataAuthor, setMetadataAuthor] = useState(getMetadataAuthor);
  const [externalDocument, setExternalDocument] = useState(false);
  const [documentEditable, setDocumentEditable] = useState(true);
  const [sampleDocument, setSampleDocument] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const showOutlineForExternalOpen = useCallback(() => {
    const editorState = useTabsStore.getState();
    if (editorState.focusMode) editorState.toggleFocusMode();
    setSidebarTab("outline");
    if (sidebarVisibleRef.current) return;
    // 文件关联打开只改变本次窗口状态，不能覆盖用户的常规启动偏好。
    skipSidebarPreferenceWriteRef.current = true;
    setSidebarVisible(true);
  }, []);
  const [typewriterPadding, setTypewriterPadding] = useState(getTypewriterPadding);
  const [showStatusBar, setShowStatusBar] = useState(getShowStatusBar);

  const createNewDocumentContent = useCallback(() => {
    if (!newDocumentMetadata) return "";
    return formatFrontMatter({
      title: metadataTitle,
      author: metadataAuthor,
      date: formatLocalDate(Date.now()),
    });
  }, [newDocumentMetadata, metadataTitle, metadataAuthor]);

  const finishImportedFile = useCallback((path: string, rename: boolean) => {
    setDirTick((value) => value + 1);
    if (rename) {
      setFileRenameRequest({ path, id: ++fileRenameIdRef.current });
      show(t(locale, "toast.fileImportedRename"));
    } else {
      showSuccess(t(locale, "toast.fileImported"));
    }
  }, [locale, show, showSuccess]);

  const askFileConflict = useCallback((path: string, targetDir: string) => (
    new Promise<FileConflictAction | "cancel">((resolve) => {
      fileConflictResolveRef.current = resolve;
      setImportConflict({ path, targetDir });
    })
  ), []);

  const resolveImportConflict = useCallback((action: FileConflictAction | "cancel") => {
    fileConflictResolveRef.current?.(action);
    fileConflictResolveRef.current = null;
    setImportConflict(null);
  }, []);

  const handleTransferPath = useCallback(async (
    path: string,
    targetDir: string,
    mode: "copy" | "cut",
  ): Promise<string | null> => {
    const transferMode: DocumentTransferMode = mode === "cut" ? "move" : "copy";
    try {
      return await transferDocumentWithManagedImages(path, targetDir, transferMode);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== t(locale, "error.fileExists")) throw error;
      const action = await askFileConflict(path, targetDir);
      if (action === "cancel") return null;
      const transferredPath = await transferDocumentWithManagedImages(path, targetDir, transferMode, action);
      if (action === "rename") {
        setFileRenameRequest({ path: transferredPath, id: ++fileRenameIdRef.current });
      }
      return transferredPath;
    }
  }, [locale, askFileConflict]);

  const fileName = useMemo(() => {
    if (!active?.path) return t(locale, "title.untitled");
    return active.path.split(/[\\/]/).pop() || active.path;
  }, [active?.path, locale]);

  const setTitle = useCallback((path: string | null) => {
    const name = path
      ? path.split(/[\\/]/).pop() || path
      : t(locale, "title.untitled");
    const brand = locale === "zh" ? "墨笺 InkNote" : "InkNote";
    getCurrentWindow().setTitle(`${name} — ${brand}`);
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

  const saveExistingTab = useCallback(async (tab: TabDoc): Promise<boolean> => {
    if (!tab.path) return false;
    try {
      const preparedImages = await preparePendingImages(tab.path);
      await api.writeFile(tab.path, tab.content);
      commitPendingImages(preparedImages);
      try {
        await cleanupRemovedManagedImages(tab.path, tab.diskContent, tab.content);
      } catch (error) {
        showError(error);
      }
      markSaved(tab.id, tab.path, tab.content);
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }, [markSaved, showError]);

  const confirmDiscardIfNeeded = useCallback(async () => {
    const tab = getActive();
    if (!tab?.dirty) return true;
    if (tab.path) return saveExistingTab(tab);
    if (!confirmDiscard) return true;
    return askConfirm(t(locale, "confirm.discard"));
  }, [getActive, saveExistingTab, confirmDiscard, locale, askConfirm]);

  const loadFile = useCallback(
    async (path: string, options: { external?: boolean } = {}) => {
      if (!(await confirmDiscardIfNeeded())) return false;
      const request = ++fileLoadRequestRef.current;
      const external = options.external === true;
      try {
        const text = await api.readFile(path);
        if (request !== fileLoadRequestRef.current) return false;
        clearPendingImages();
        const openedId = openTab(path, text);
        if (external && externalOpenReadOnly) setMode(openedId, "preview");
        setExternalDocument(external);
        setDocumentEditable(!(external && externalOpenReadOnly));
        setSampleDocument(false);
        addRecentFile(path);
        setRecentFiles(getRecentFiles());
        setTitle(path);
        if (!external) setLastFile(path);
        void api.watchFile(path).catch(showError);
        return true;
      } catch (e) {
        if (request !== fileLoadRequestRef.current) return false;
        removeRecentFile(path);
        if (!external && getLastFile() === path) clearLastFile();
        setRecentFiles(getRecentFiles());
        showError(e);
        return false;
      }
    },
    [openTab, setMode, setTitle, confirmDiscardIfNeeded, showError, externalOpenReadOnly],
  );

  const openFileAtLine = useCallback(
    async (path: string, line: number) => {
      const tab = getActive();
      if (tab?.path === path) {
        requestAnimationFrame(() => editorRef.current?.scrollToLine(line));
        return true;
      }
      scrollAfterLoadRef.current = line;
      const loaded = await loadFile(path);
      if (!loaded) scrollAfterLoadRef.current = null;
      return loaded;
    },
    [getActive, loadFile],
  );

  const openFile = useCallback(async () => {
    // 不在这里问「是否放弃更改」：loadFile 里已经会问，否则会连问两次
    const p = await api.openFileDialog();
    if (p) await loadFile(p);
  }, [loadFile]);

  const openFolder = useCallback(async () => {
    const selected = await api.openFolderDialog();
    if (!selected.length) return;
    setFolderPaths((current) => {
      const next = [...new Set([...current, ...selected])];
      setWorkspaceFolders(next);
      return next;
    });
    setSidebarVisible(true);
    setSidebarTab("files");
    persistSidebarTab("files");
  }, []);

  const handleRemoveWorkspaceFolder = useCallback((path: string) => {
    removeTreeExpansion(path);
    setFolderPaths((current) => {
      const next = current.filter((folder) => folder !== path);
      setWorkspaceFolders(next);
      return next;
    });
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
        if (tab.path && tab.path === path) {
          try {
            await cleanupRemovedManagedImages(path, tab.diskContent, tab.content);
          } catch (error) {
            showError(error);
          }
        }
        markSaved(tab.id, path, tab.content);
        addRecentFile(path);
        setRecentFiles(getRecentFiles());
        setTitle(path);
        setLastFile(path);
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
    let managedImages: Awaited<ReturnType<typeof prepareManagedImagesForSaveAs>> | null = null;
    let documentWritten = false;
    try {
      managedImages = await prepareManagedImagesForSaveAs(tab.path, p, tab.content);
      const preparedImages = await preparePendingImages(p);
      await api.writeFile(p, managedImages.content);
      documentWritten = true;
      commitPendingImages(preparedImages);
      const currentTab = useTabsStore.getState().tabs.find((candidate) => candidate.id === tab.id);
      if (currentTab) {
        const currentContent = rewriteManagedImageReferences(currentTab.content, managedImages.replacements);
        if (currentContent !== currentTab.content) updateContent(tab.id, currentContent);
      }
      markSaved(tab.id, p, managedImages.content);
      addRecentFile(p);
      setRecentFiles(getRecentFiles());
      setTitle(p);
      setLastFile(p);
      await api.watchFile(p);
      showSuccess(t(locale, "toast.saved"));
    } catch (e) {
      if (!documentWritten) await managedImages?.rollback();
      showError(e);
    }
  }, [getActive, markSaved, setTitle, showError, showSuccess, locale, updateContent]);

  const exportHtml = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const path = await api.saveHtmlDialog();
    if (!path) return;
    try {
      const { markdownToHtml } = await import("./render/export");
      const pendingImages = await pendingImageDataUrls();
      const html = await markdownToHtml(tab.content, resolveTheme(), locale, tab.path, true, markdownTheme, pendingImages);
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
      const { markdownToHtml } = await import("./render/export");
      const pendingImages = await pendingImageDataUrls();
      const html = await markdownToHtml(tab.content, resolveTheme(), locale, tab.path, true, markdownTheme, pendingImages);
      await api.exportPdf(path, html);
      showSuccess(t(locale, "toast.exported"));
    } catch (e) {
      showError(e);
    }
  }, [getActive, locale, markdownTheme, showError, showSuccess]);

  const handleNewFile = useCallback(async () => {
    if (!(await confirmDiscardIfNeeded())) return;
    fileLoadRequestRef.current++;
    clearPendingImages();
    setExternalDocument(false);
    setDocumentEditable(true);
    setSampleDocument(false);
    setWelcomeDismissed(true);
    clearLastFile();
    newTab(createNewDocumentContent());
    setTitle(null);
    show(t(locale, "toast.newDocument"));
  }, [newTab, createNewDocumentContent, setTitle, confirmDiscardIfNeeded, show, locale]);

  const handleCloseFile = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    let savedBeforeClose = false;
    if (tab.dirty && tab.path) {
      savedBeforeClose = await saveExistingTab(tab);
      if (!savedBeforeClose) return;
    }
    if (tab.dirty && !tab.path && confirmDiscard) {
      const ok = await askConfirm(t(locale, "confirm.close"));
      if (!ok) return;
    }
    const closedSnapshot = {
      path: tab.path,
      content: tab.content,
      diskContent: savedBeforeClose ? tab.content : tab.diskContent,
      dirty: savedBeforeClose ? false : tab.dirty,
      mode: tab.mode,
      externalDocument,
      documentEditable,
      sampleDocument,
      pendingImages: snapshotPendingImages(),
    };
    fileLoadRequestRef.current++;
    clearPendingImages();
    setExternalDocument(false);
    setDocumentEditable(true);
    setSampleDocument(false);
    setWelcomeDismissed(false);
    if (tab.path || tab.content.trim()) {
      closedDocRef.current = closedSnapshot;
      setCanReopenClosed(true);
    }
    closeTab(tab.id);
    if (!externalDocument && !sampleDocument) clearLastFile();
    setTitle(null);
  }, [getActive, closeTab, setTitle, saveExistingTab, confirmDiscard, locale, askConfirm, externalDocument, documentEditable, sampleDocument]);

  const handleReopenClosed = useCallback(async () => {
    const snap = closedDocRef.current;
    if (!snap) {
      show(t(locale, "toast.nothingToReopen"));
      return;
    }
    if (!(await confirmDiscardIfNeeded())) return;
    fileLoadRequestRef.current++;
    restorePendingImages(snap.pendingImages);
    restoreTab(snap);
    setExternalDocument(snap.externalDocument);
    setDocumentEditable(snap.documentEditable);
    setSampleDocument(snap.sampleDocument);
    setWelcomeDismissed(true);
    closedDocRef.current = null;
    setCanReopenClosed(false);
    setTitle(snap.path);
    if (snap.path) {
      try {
        if (!snap.externalDocument) setLastFile(snap.path);
        await api.watchFile(snap.path);
      } catch (e) {
        showError(e);
      }
    } else {
      api.unwatchFile();
    }
    show(t(locale, "toast.reopened"));
  }, [confirmDiscardIfNeeded, restoreTab, setTitle, show, showError, locale]);

  const handleRenamePath = useCallback(
    async (path: string, newName: string, _isDir: boolean) => {
      const base = basename(path);
      if (!newName || newName === base) return false;
      const parent = dirOf(path);
      const newPath = joinPath(parent, newName);
      try {
        await api.renamePath(path, newPath);
        remapRecentFiles(path, newPath);
        remapLastFile(path, newPath);
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
        return true;
      } catch (e) {
        showError(e);
        return false;
      }
    },
    [active, setPath, showError],
  );

  const handleMovePath = useCallback((oldPath: string, newPath: string) => {
    remapRecentFiles(oldPath, newPath);
    remapLastFile(oldPath, newPath);
    if (active?.path === oldPath) setPath(active.id, newPath);
    setRecentFiles(getRecentFiles());
  }, [active, setPath]);

  const handleDeletePath = useCallback(
    async (path: string, isDir: boolean) => {
      const name = basename(path);
      if (confirmDelete) {
        const msg = isDir
          ? t(locale, "confirm.deleteFolder", { name })
          : t(locale, "confirm.deleteFile", { name });
        const ok = await askConfirm(msg);
        if (!ok) return false;
      }
      const sep = path.includes("\\") ? "\\" : "/";
      const affectsActive = active?.path === path || (isDir && active?.path?.startsWith(path + sep));
      if (affectsActive && active?.dirty && confirmDiscard) {
        const ok = await askConfirm(t(locale, "confirm.discard"));
        if (!ok) return false;
      }
      if (affectsActive) fileLoadRequestRef.current++;
      try {
        if (!isDir && /\.(md|markdown|txt)$/i.test(path)) await removeDocumentWithManagedImages(path);
        else await api.removePath(path);
        removeRecentFilesUnder(path);
        clearLastFileUnder(path);
        if (affectsActive) {
          clearPendingImages();
          newTab();
          setExternalDocument(false);
          setDocumentEditable(true);
          setSampleDocument(false);
          setWelcomeDismissed(false);
          setTitle(null);
        }
        setDirTick((t) => t + 1);
        setRecentFiles(getRecentFiles());
        return true;
      } catch (e) {
        showError(e);
        return false;
      }
    },
    [active, confirmDelete, confirmDiscard, locale, showError, askConfirm, newTab, setTitle],
  );

  const handleCreateFileInFolder = useCallback(
    async (parentDir: string, name: string) => {
      const path = joinPath(parentDir, name);
      try {
        await api.createFile(path, createNewDocumentContent());
        setDirTick((t) => t + 1);
        await loadFile(path);
      } catch (e) {
        showError(e);
      }
    },
    [loadFile, showError, createNewDocumentContent],
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

  const handleChange = useCallback(
    (doc: string) => {
      if (!activeTabId || !documentEditable) return;
      updateContent(activeTabId, doc);
    },
    [activeTabId, documentEditable, updateContent],
  );

  const handleModeChange = useCallback(
    (mode: "preview" | "source") => {
      if (activeTabId) setMode(activeTabId, mode);
    },
    [activeTabId, setMode],
  );

  const toggleEditorMode = useCallback(() => {
    if (!documentEditable) {
      show(t(locale, "toast.previewMode"));
      return;
    }
    const tab = getActive();
    if (!tab || !activeTabId) return;
    setMode(activeTabId, tab.mode === "preview" ? "source" : "preview");
  }, [documentEditable, show, locale, getActive, activeTabId, setMode]);

  const handleSidebarTab = useCallback((tab: SidebarTab) => {
    if (focusMode) toggleFocusMode();
    setSidebarVisible(true);
    setSidebarTab(tab);
    persistSidebarTab(tab);
  }, [focusMode, toggleFocusMode]);

  const openWorkspaceSearchResult = useCallback((path: string, line: number) => {
    void openFileAtLine(path, line).then((opened) => {
      if (!opened) return;
      if (focusMode) toggleFocusMode();
      setSidebarVisible(true);
      setSidebarTab("files");
      persistSidebarTab("files");
      setFileRevealRequest({ path, id: ++fileRevealIdRef.current });
    });
  }, [focusMode, openFileAtLine, toggleFocusMode]);

  const handleRemoveRecent = useCallback((path: string) => {
    removeRecentFile(path);
    setRecentFiles(getRecentFiles());
  }, []);

  const openDocumentSearch = useCallback((replace: boolean) => {
    const query = editorRef.current?.getSelectedText().trim() ?? "";
    setDocumentSearch({ open: true, replace, query });
  }, []);

  const runEditorAction = useCallback((action: EditorAction) => {
    if (action === "find" || action === "findReplace") {
      openDocumentSearch(action === "findReplace");
      return;
    }
    if (!documentEditable && !["copy", "selectAll", "copyHtml"].includes(action)) {
      show(t(locale, "toast.previewReadOnly"));
      return;
    }
    editorRef.current?.runAction(action);
  }, [openDocumentSearch, documentEditable, show, locale]);

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
      showError(new Error(t(locale, "error.externalFileMissing")));
    }
  }, [getActive, loadFromDisk, show, showError, locale]);

  const reloadFromDisk = useCallback(async () => {
    const tab = getActive();
    if (!tab?.path) return;
    try {
      const disk = await api.readFile(tab.path);
      loadFromDisk(tab.id, tab.path, disk);
      setReloadPrompt(false);
      show(t(locale, "toast.reloaded"));
    } catch (error) {
      showError(error);
    }
  }, [getActive, loadFromDisk, show, showError, locale]);

  const handleOpenSample = useCallback(async () => {
    if (!(await confirmDiscardIfNeeded())) return;
    const request = ++fileLoadRequestRef.current;
    try {
      const res = await fetch("/sample.md");
      if (!res.ok) throw new Error(`Could not load sample document (${res.status})`);
      const text = await res.text();
      if (request !== fileLoadRequestRef.current) return;
      clearPendingImages();
      setExternalDocument(false);
      setDocumentEditable(false);
      setSampleDocument(true);
      const tabId = newTab(text);
      markSaved(tabId, undefined, text);
      setMode(tabId, "preview");
      setTitle(null);
    } catch (e) {
      if (request === fileLoadRequestRef.current) showError(e);
    }
  }, [confirmDiscardIfNeeded, newTab, markSaved, setMode, setTitle, showError]);

  const handleDroppedMarkdown = useCallback(
    async (content: string, path?: string) => {
      if (path) {
        if (await loadFile(path, { external: true })) showOutlineForExternalOpen();
        return;
      }
      if (!(await confirmDiscardIfNeeded())) return;
      fileLoadRequestRef.current++;
      clearPendingImages();
      setExternalDocument(false);
      setDocumentEditable(true);
      setSampleDocument(false);
      clearLastFile();
      newTab();
      const tab = getActive();
      if (tab) updateContent(tab.id, content);
      setTitle(null);
    },
    [loadFile, showOutlineForExternalOpen, confirmDiscardIfNeeded, newTab, getActive, updateContent, setTitle],
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

  const handleCheckUpdates = useCallback(async () => {
    if (updateRunningRef.current) {
      show(t(locale, "update.inProgress"));
      return;
    }
    updateRunningRef.current = true;
    setUpdateProgress({
      phase: "checking",
      percent: 0,
      downloaded: 0,
      total: 0,
    });
    try {
      const update = await check();
      if (!update) {
        setUpdateProgress(null);
        showSuccess(t(locale, "update.latest"));
        return;
      }
      setUpdateProgress(null);
      const install = await askConfirm(t(locale, "update.available", { v: update.version }));
      if (!install) {
        await update.close();
        return;
      }

      const activeTab = getActive();
      if (activeTab?.dirty && !(await saveTab(activeTab.id))) {
        await update.close();
        return;
      }

      let downloaded = 0;
      let total = 0;
      let percent = 0;
      setUpdateProgress({
        phase: "downloading",
        version: update.version,
        percent,
        downloaded,
        total,
      });
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          downloaded = 0;
          total = event.data.contentLength ?? 0;
          percent = 0;
          setUpdateProgress({
            phase: "downloading",
            version: update.version,
            percent,
            downloaded,
            total,
          });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          percent = nextUpdatePercent(downloaded, total, percent);
          setUpdateProgress({
            phase: "downloading",
            version: update.version,
            percent,
            downloaded,
            total,
          });
        } else if (event.event === "Finished") {
          setUpdateProgress({
            phase: "installing",
            version: update.version,
            percent: 100,
            downloaded,
            total,
          });
        }
      });
      showSuccess(t(locale, "update.installed"));
      await relaunch();
    } catch (error) {
      showError(error);
    } finally {
      updateRunningRef.current = false;
      setUpdateProgress(null);
    }
  }, [askConfirm, getActive, locale, saveTab, show, showError, showSuccess]);

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
    handleCheckUpdates,
    handleNewFile,
    handleCloseFile,
    handleReopenClosed,
    openFolder,
    runEditorAction,
    toggleEditorMode,
    handleSidebarTab,
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
    handleCheckUpdates,
    handleNewFile,
    handleCloseFile,
    handleReopenClosed,
    openFolder,
    runEditorAction,
    toggleEditorMode,
    handleSidebarTab,
  };

  useEffect(() => {
    void setupMacNativeMenu(locale).catch(showError);
  }, [locale, showError]);

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

    const handleOpenFile = (p: string) => {
      if (!disposed) {
        void bootRef.current.loadFile(p, { external: true }).then((opened) => {
          if (opened && !disposed) showOutlineForExternalOpen();
        });
      }
    };
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
    const onNativeMenu = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      const b = bootRef.current;
      if (action.startsWith("editor:")) {
        b.runEditorAction(action.slice("editor:".length) as EditorAction);
        return;
      }
      switch (action) {
        case "new": void b.handleNewFile(); break;
        case "open": void b.openFile(); break;
        case "open-folder": void b.openFolder(); break;
        case "quick-open": setQuickOpenOpen(true); break;
        case "close-file": void b.handleCloseFile(); break;
        case "reopen-closed": void b.handleReopenClosed(); break;
        case "save": void b.saveTab(); break;
        case "save-as": void b.saveAs(); break;
        case "export-html": void b.exportHtml(); break;
        case "export-pdf": void b.exportPdf(); break;
        case "settings": setSettingsOpen(true); break;
        case "about": setAboutOpen(true); break;
        case "shortcuts": setShortcutsOpen(true); break;
        case "check-updates": void b.handleCheckUpdates(); break;
        case "search-files": setGlobalSearchOpen(true); break;
        case "toggle-sidebar": setSidebarVisible((value) => !value); break;
        case "toggle-mode": b.toggleEditorMode(); break;
        case "focus-mode": b.handleToggleFocus(); break;
        case "typewriter-mode": b.handleToggleTypewriter(); break;
        case "fullscreen": void getCurrentWindow().isFullscreen().then((value) => getCurrentWindow().setFullscreen(!value)); break;
        case "sidebar-files": b.handleSidebarTab("files"); break;
        case "sidebar-outline": b.handleSidebarTab("outline"); break;
        case "sidebar-recent": b.handleSidebarTab("recent"); break;
      }
    };
    window.addEventListener(NATIVE_MENU_EVENT, onNativeMenu);
    void api.onOpenFile(handleOpenFile).then((f) => {
      if (disposed) {
        f();
        return;
      }
      un.push(f);
      void api.getStartupFile().then((p) => {
        if (disposed) return;
        if (p) {
          handleOpenFile(p);
          return;
        }
        if (getRestoreLastFolder()) {
          const savedFolders = getWorkspaceFolders();
          void Promise.all(
            savedFolders.map(async (folder) => {
              try {
                await api.listDir(folder);
                return folder;
              } catch {
                return null;
              }
            }),
          ).then((folders) => {
            if (disposed) return;
            const valid = folders.filter((folder): folder is string => folder !== null);
            setFolderPaths(valid);
            setWorkspaceFolders(valid);
            if (!valid.length) clearLastFolder();
          });
        }
        if (getRestoreLastFile()) {
          const last = getLastFile();
          if (last) void bootRef.current.loadFile(last);
        }
      });
    });

    return () => {
      disposed = true;
      un.forEach((f) => f());
      window.removeEventListener(NATIVE_MENU_EVENT, onNativeMenu);
      api.unwatchFile();
    };
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => applyTheme();
    media.addEventListener("change", refresh);
    return () => media.removeEventListener("change", refresh);
  }, [theme]);

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
      pickImage: (defaultAlt, defaultPath = "") =>
        new Promise((resolve) => {
          imageResolveRef.current = resolve;
          setImageDialog({ alt: defaultAlt, path: defaultPath });
        }),
      requestSave: () => saveTab(),
      requestSearch: openDocumentSearch,
      showError,
      showMessage: (msg) => show(msg),
    });
    return () => setEditorBridge(null);
  }, [askConfirm, saveTab, openDocumentSearch, showError, show]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let hoverRequest = 0;
    const win = getCurrentWindow();
    const scaleFactor = win.scaleFactor();
    const directoryAt = async (position: { x: number; y: number }) => {
      const factor = await scaleFactor;
      const element = document.elementFromPoint(position.x / factor, position.y / factor);
      return element?.closest<HTMLElement>("[data-tree-drop-dir]")?.dataset.treeDropDir ?? null;
    };
    const updateDropTarget = async (position: { x: number; y: number }) => {
      const request = ++hoverRequest;
      const target = await directoryAt(position);
      if (!disposed && request === hoverRequest) setTreeDropTarget(target);
    };

    void win.onDragDropEvent(({ payload }) => {
      if (disposed) return;
      if (payload.type === "enter" || payload.type === "over") {
        void updateDropTarget(payload.position);
      } else if (payload.type === "leave") {
        hoverRequest++;
        setTreeDropTarget(null);
      } else if (payload.type === "drop") {
        hoverRequest++;
        setTreeDropTarget(null);
        const path = payload.paths.find((candidate) => /\.(md|markdown|txt)$/i.test(candidate));
        if (!path) return;
        void directoryAt(payload.position).then(async (targetDir) => {
          if (disposed) return;
          if (targetDir) {
            try {
              const copiedPath = await handleTransferPath(path, targetDir, "copy");
              if (copiedPath) finishImportedFile(copiedPath, basename(copiedPath) !== basename(path));
            } catch (error) {
              showError(error);
            }
            return;
          }
          if (await loadFile(path, { external: true })) showOutlineForExternalOpen();
        });
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadFile, showOutlineForExternalOpen, finishImportedFile, handleTransferPath, showError]);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.onCloseRequested(async (event) => {
      event.preventDefault();
      if (closingRef.current) return;
      closingRef.current = true;
      await flushSettingsStore();

      const tab = getActive();
      if (!tab?.dirty) {
        await win.destroy();
        return;
      }

      if (!tab.path) {
        const shouldSave = await askConfirm(t(locale, "confirm.saveBeforeClose"));
        if (!shouldSave) {
          closingRef.current = false;
          return;
        }
        const path = await saveTab(tab.id);
        if (path) await win.destroy();
        else closingRef.current = false;
        return;
      }

      if (await saveExistingTab(tab)) await win.destroy();
      else closingRef.current = false;
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [getActive, saveExistingTab, saveTab, askConfirm, locale]);

  useEffect(() => {
    const modalOpen =
      settingsOpen ||
      reloadPrompt ||
      tablePickerOpen ||
      confirmMessage ||
      linkDialogText !== null ||
      imageDialog !== null ||
      promptDialog ||
      importConflict ||
      shortcutsOpen ||
      aboutOpen ||
      globalSearchOpen ||
      quickOpenOpen ||
      documentSearch.open;

    const onKey = (e: KeyboardEvent) => {
      if (isMac && e.ctrlKey && e.metaKey && e.key.toLowerCase() === "f") {
        if (modalOpen) return;
        e.preventDefault();
        void getCurrentWindow().isFullscreen().then((fs) => getCurrentWindow().setFullscreen(!fs));
        return;
      }
      if (e.key === "F8") {
        if (modalOpen) return;
        e.preventDefault();
        handleToggleFocus();
        return;
      }
      if (e.key === "F9") {
        if (modalOpen) return;
        e.preventDefault();
        handleToggleTypewriter();
        return;
      }
      if (e.key === "F11") {
        if (modalOpen) return;
        e.preventDefault();
        void getCurrentWindow().isFullscreen().then((fs) => getCurrentWindow().setFullscreen(!fs));
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (e.shiftKey && (e.code === "KeyF" || k === "f")) {
        e.preventDefault();
        e.stopPropagation();
        if (modalOpen && !globalSearchOpen) return;
        setGlobalSearchOpen(true);
        return;
      }
      const findReplacePressed = isMac
        ? e.metaKey && e.altKey && k === "f" && !e.shiftKey
        : e.ctrlKey && !e.altKey && k === "h" && !e.shiftKey;
      if (findReplacePressed) {
        e.preventDefault();
        e.stopPropagation();
        if (modalOpen && !documentSearch.open) return;
        if (documentSearch.open) {
          setDocumentSearch((current) => ({ ...current, replace: true }));
        } else {
          openDocumentSearch(true);
        }
        return;
      }
      if (k === "f" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (modalOpen && !documentSearch.open) return;
        if (!documentSearch.open) openDocumentSearch(false);
        return;
      }
      if (modalOpen) return;
      if (k === "p" && !e.shiftKey) {
        e.preventDefault();
        setQuickOpenOpen(true);
      } else if (k === "l" && e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (k === "/" || e.key === "?") {
        e.preventDefault();
        toggleEditorMode();
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
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
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
    imageDialog,
    promptDialog,
    importConflict,
    shortcutsOpen,
    aboutOpen,
    globalSearchOpen,
    quickOpenOpen,
    documentSearch.open,
    openDocumentSearch,
  ]);

  useEffect(() => {
    const paths = [...folderPaths];
    dirWatchChainRef.current = dirWatchChainRef.current
      .catch(() => undefined)
      .then(() => (paths.length ? api.watchDirs(paths) : api.unwatchDir()))
      .catch(showError);
  }, [folderPaths, showError]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    api.onDirChanged(() => {
      if (!disposed) setDirTick((t) => t + 1);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    setExternalDocument(false);
    setDocumentEditable(true);

    return () => {
      disposed = true;
      unlisten?.();
      dirWatchChainRef.current = dirWatchChainRef.current
        .catch(() => undefined)
        .then(() => api.unwatchDir())
        .catch(() => undefined);
    };
  }, []);

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
    persistExternalOpenReadOnly(externalOpenReadOnly);
  }, [externalOpenReadOnly]);

  useEffect(() => {
    invalidateWorkspaceFileCache();
  }, [dirTick, folderPaths, recentFiles]);

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

  const outline = useMemo(
    () => extractMarkdownOutline(active?.content ?? ""),
    [active?.content],
  );

  const setDocumentAccessMode = useCallback((editable: boolean) => {
    if (documentEditable === editable) return;
    if (editable) editorRef.current?.resetContent(active?.content ?? "");
    if (!editable && activeTabId) setMode(activeTabId, "preview");
    setDocumentEditable(editable);
    show(t(locale, editable ? "toast.editMode" : "toast.previewMode"));
  }, [documentEditable, active?.content, activeTabId, setMode, show, locale]);

  const showWelcome = !welcomeDismissed && !active?.path && !active?.content.trim();
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
        documentEditable={documentEditable}
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
        onCheckUpdates={() => void handleCheckUpdates()}
        onOpenAbout={() => setAboutOpen(true)}
        onGlobalSearch={() => setGlobalSearchOpen(true)}
        onQuickOpen={() => setQuickOpenOpen(true)}
        onOpenRecent={(p) => void loadFile(p)}
        onReopenClosed={() => void handleReopenClosed()}
        canReopenClosed={canReopenClosed}
        recentFiles={recentFiles}
      />
      <div className="app-body">
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
              folderPaths={folderPaths}
              dirTick={dirTick}
              onOpenPath={(p) => loadFile(p)}
              onRefreshTree={() => setDirTick((t) => t + 1)}
              onCreateFileInDir={folderPaths.length ? handleCreateFileInFolder : undefined}
              onCreateFolderInDir={folderPaths.length ? handleCreateFolderInDir : undefined}
              onRenamePath={folderPaths.length ? handleRenamePath : undefined}
              onTransferPath={folderPaths.length ? handleTransferPath : undefined}
              onMovePath={folderPaths.length ? handleMovePath : undefined}
              onDeletePath={folderPaths.length ? handleDeletePath : undefined}
              onRemoveFolder={handleRemoveWorkspaceFolder}
              outline={outline}
              activeOutlineLine={activeOutlineLine}
              onOutlineClick={scrollToHeading}
              currentPath={active?.path ?? null}
              recentFiles={recentFiles}
              onRemoveRecent={handleRemoveRecent}
              onOpenFolder={() => void openFolder()}
              onError={showError}
              revealRequest={fileRevealRequest}
              renameRequest={fileRenameRequest}
              onRenameRequestHandled={handleRenameRequestHandled}
              dropTargetDir={treeDropTarget}
            />
          </SidebarPanel>
        )}
        <main className={`main${externalDocument && active?.path ? " has-document-access-switch" : ""}`}>
          {externalDocument && active?.path && (
            <div className="document-access-switch" role="group" aria-label={t(locale, "documentAccess.label")}>
              <button
                type="button"
                className={!documentEditable ? "active" : ""}
                onClick={() => setDocumentAccessMode(false)}
              >
                {t(locale, "documentAccess.preview")}
              </button>
              <button
                type="button"
                className={documentEditable ? "active" : ""}
                onClick={() => setDocumentAccessMode(true)}
              >
                {t(locale, "documentAccess.edit")}
              </button>
            </div>
          )}
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
            <Suspense fallback={<div className="editor-loading" aria-hidden="true" />}>
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
                readOnly={!documentEditable}
                onChange={handleChange}
                onModeChange={handleModeChange}
                onCursorLine={setCursorLine}
                onViewportRange={(from, to) => setViewportRange({ from, to })}
                onOpenMarkdown={(content, path) => void handleDroppedMarkdown(content, path)}
              />
            </Suspense>
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
            externalOpenReadOnly,
            newDocumentMetadata,
            metadataTitle,
            metadataAuthor,
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
            onExternalOpenReadOnly: setExternalOpenReadOnly,
            onNewDocumentMetadata: (on) => {
              setNewDocumentMetadata(on);
              persistNewDocumentMetadata(on);
              show(t(locale, on ? "toast.newDocumentMetadataOn" : "toast.newDocumentMetadataOff"));
            },
            onMetadataTitle: (value) => {
              setMetadataTitle(value);
              persistMetadataTitle(value);
            },
            onMetadataAuthor: (value) => {
              setMetadataAuthor(value);
              persistMetadataAuthor(value);
            },
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
      <UpdateProgress locale={locale} state={updateProgress} />
      {confirmMessage && (
        <ConfirmDialog
          locale={locale}
          message={confirmMessage}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
      {importConflict && (
        <FileConflictDialog
          locale={locale}
          fileName={basename(importConflict.path)}
          onOverwrite={() => void resolveImportConflict("overwrite")}
          onRename={() => void resolveImportConflict("rename")}
          onCancel={() => void resolveImportConflict("cancel")}
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
      {imageDialog !== null && (
        <ImageInsertDialog
          locale={locale}
          defaultAlt={imageDialog.alt}
          defaultPath={imageDialog.path}
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
            setImageDialog(null);
          }}
          onCancel={() => {
            imageResolveRef.current?.(null);
            imageResolveRef.current = null;
            setImageDialog(null);
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
      {documentSearch.open && (
        <DocumentSearchDialog
          locale={locale}
          content={active?.content ?? ""}
          editable={documentEditable}
          initialReplace={documentSearch.replace}
          initialQuery={documentSearch.query}
          onSelectLine={scrollToHeading}
          onReplaceContent={(content, line) => {
            if (active) updateContent(active.id, content);
            requestAnimationFrame(() => scrollToHeading(line));
          }}
          onClose={() => setDocumentSearch({ open: false, replace: false, query: "" })}
        />
      )}
      {globalSearchOpen && (
        <GlobalSearchDialog
          locale={locale}
          folderPaths={folderPaths}
          onOpenResult={openWorkspaceSearchResult}
          onOpenFolder={() => void openFolder()}
          onClose={() => setGlobalSearchOpen(false)}
        />
      )}
      {quickOpenOpen && (
        <QuickOpenDialog
          locale={locale}
          folderPaths={folderPaths}
          recentFiles={recentFiles}
          currentPath={active?.path ?? null}
          onOpen={(p) => void loadFile(p)}
          onClose={() => setQuickOpenOpen(false)}
        />
      )}
    </div>
  );
}
