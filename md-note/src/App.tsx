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
import * as api from "./lib/tauri";
import { initPlatform } from "./lib/platform";
import { addRecentFile, clearRecentFiles, getRecentFiles, removeRecentFile, trimRecentFiles } from "./lib/recent";
import {
  getLastFolder,
  setLastFolder,
  clearLastFolder,
  getSidebarTab,
  setSidebarTab as persistSidebarTab,
  type SavedSidebarTab,
} from "./lib/workspace";
import { apply as applyTheme, getThemePref, resolveTheme, setThemePref, type ThemePref } from "./lib/theme";
import { getLocale, setLocale, t, type Locale } from "./lib/i18n";
import {
  applyEditorLayoutPrefs,
  getAutosave,
  getAutosaveDelay,
  getConfirmDelete,
  getConfirmDiscard,
  getDefaultEditorMode,
  getDefaultSidebarTab,
  getEditorMaxWidth,
  getFocusMaxWidth,
  getFontSize,
  getLineHeight,
  getLineNumbers,
  getRecentFilesLimit,
  getRestoreLastFolder,
  getShowStatusBar,
  getSidebarVisiblePref,
  getSpellCheck,
  getTabSize,
  getTypewriterPadding,
  getWordWrap,
  setAutosave as persistAutosave,
  setAutosaveDelay as persistAutosaveDelay,
  setConfirmDelete as persistConfirmDelete,
  setConfirmDiscard as persistConfirmDiscard,
  setDefaultEditorMode,
  setDefaultSidebarTab,
  setEditorMaxWidth as persistEditorMaxWidth,
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
} from "./lib/preferences";
import { markdownToHtml, printHtml } from "./render/export";
import { parseFrontMatter, updateFrontMatter } from "./lib/frontmatter";
import { dirOf, joinPath, basename } from "./lib/paths";
import { useTabsStore } from "./store/useTabsStore";
import type { EditorAction } from "./editor";
import { setTableInsertRequestHandler } from "./editor/tableInsertBridge";

export default function App() {
  const editorRef = useRef<EditorRef>(null);
  const {
    tabs,
    activeId,
    focusMode,
    typewriterMode,
    openTab,
    newTab,
    closeTab,
    updateContent,
    setMode,
    markSaved,
    getActive,
    toggleFocusMode,
    toggleTypewriterMode,
  } = useTabsStore();

  const active = getActive();
  const activeTabId = active?.id ?? activeId;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(getSidebarTab);
  const [sidebarVisible, setSidebarVisible] = useState(getSidebarVisiblePref);
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [dirTick, setDirTick] = useState(0);
  const [recentFiles, setRecentFiles] = useState(getRecentFiles);
  const [reloadPrompt, setReloadPrompt] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [fontSize, setFontSize] = useState(getFontSize);
  const [lineHeight, setLineHeight] = useState(getLineHeight);
  const [editorMaxWidth, setEditorMaxWidth] = useState(getEditorMaxWidth);
  const [focusMaxWidth, setFocusMaxWidth] = useState(getFocusMaxWidth);
  const [autosave, setAutosave] = useState(getAutosave);
  const [autosaveDelay, setAutosaveDelay] = useState(getAutosaveDelay);
  const [restoreLastFolder, setRestoreLastFolder] = useState(getRestoreLastFolder);
  const [confirmDiscard, setConfirmDiscard] = useState(getConfirmDiscard);
  const [confirmDelete, setConfirmDelete] = useState(getConfirmDelete);
  const [recentFilesLimit, setRecentFilesLimit] = useState(getRecentFilesLimit);
  const [defaultSidebarTab, setDefaultSidebarTabState] = useState<SavedSidebarTab>(getDefaultSidebarTab);
  const [defaultEditorMode, setDefaultEditorModeState] = useState<DefaultEditorMode>(getDefaultEditorMode);
  const [lineNumbers, setLineNumbers] = useState(getLineNumbers);
  const [wordWrap, setWordWrap] = useState(getWordWrap);
  const [tabSize, setTabSize] = useState(getTabSize);
  const [spellCheck, setSpellCheck] = useState(getSpellCheck);
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
    getCurrentWindow().setTitle(`${name} — MDNote`);
  }, [locale]);

  const confirmDiscardIfNeeded = useCallback(() => {
    const tab = getActive();
    if (!tab?.dirty) return true;
    if (!confirmDiscard) return true;
    return window.confirm(t(locale, "confirm.discard"));
  }, [getActive, confirmDiscard, locale]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!confirmDiscardIfNeeded()) return;
      try {
        const text = await api.readFile(path);
        openTab(path, text);
        addRecentFile(path);
        setRecentFiles(getRecentFiles());
        setTitle(path);
        await api.watchFile(path);
      } catch (e) {
        console.error("打开文件失败:", e);
      }
    },
    [openTab, setTitle, confirmDiscardIfNeeded],
  );

  const openFile = useCallback(async () => {
    if (!confirmDiscardIfNeeded()) return;
    const p = await api.openFileDialog();
    if (p) await loadFile(p);
  }, [loadFile, confirmDiscardIfNeeded]);

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
    async (tabId?: string) => {
      const tab = tabId ? tabs.find((t) => t.id === tabId) : getActive();
      if (!tab) return;
      let path = tab.path;
      if (!path) {
        path = await api.saveFileDialog();
        if (!path) return;
      }
      try {
        await api.writeFile(path, tab.content);
        markSaved(tab.id, path, tab.content);
        addRecentFile(path);
        setRecentFiles(getRecentFiles());
        setTitle(path);
        await api.watchFile(path);
      } catch (e) {
        console.error("保存失败:", e);
      }
    },
    [tabs, getActive, markSaved, setTitle],
  );

  const saveAs = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const p = await api.saveFileDialog(tab.path ?? undefined);
    if (!p) return;
    try {
      await api.writeFile(p, tab.content);
      markSaved(tab.id, p, tab.content);
      addRecentFile(p);
      setRecentFiles(getRecentFiles());
      setTitle(p);
      await api.watchFile(p);
    } catch (e) {
      console.error("保存失败:", e);
    }
  }, [getActive, markSaved, setTitle]);

  const exportHtml = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const path = await api.saveHtmlDialog();
    if (!path) return;
    const html = await markdownToHtml(tab.content, resolveTheme());
    await api.writeFile(path, html);
  }, [getActive]);

  const exportPdf = useCallback(async () => {
    const tab = getActive();
    if (!tab) return;
    const html = await markdownToHtml(tab.content, resolveTheme());
    printHtml(html);
  }, [getActive]);

  const handleNewFile = useCallback(() => {
    if (!confirmDiscardIfNeeded()) return;
    newTab();
    setTitle(null);
  }, [newTab, setTitle, confirmDiscardIfNeeded]);

  const handleCloseFile = useCallback(() => {
    const tab = getActive();
    if (!tab) return;
    if (tab.dirty && confirmDiscard && !window.confirm(t(locale, "confirm.close"))) return;
    closeTab(tab.id);
    setTitle(null);
  }, [getActive, closeTab, setTitle, confirmDiscard, locale]);

  const handleRenamePath = useCallback(
    async (path: string, newName: string, _isDir: boolean) => {
      const base = basename(path);
      if (!newName || newName === base) return;
      const parent = dirOf(path);
      const newPath = joinPath(parent, newName);
      try {
        await api.renamePath(path, newPath);
        if (active?.path === path) {
          markSaved(active.id, newPath, active.content);
        } else if (active?.path?.startsWith(path + (path.includes("\\") ? "\\" : "/"))) {
          const sep = path.includes("\\") ? "\\" : "/";
          const rel = active.path.slice(path.length + 1);
          markSaved(active.id, `${newPath}${sep}${rel}`, active.content);
        }
        setDirTick((t) => t + 1);
        setRecentFiles(getRecentFiles());
      } catch (e) {
        console.error(e);
      }
    },
    [active, markSaved],
  );

  const handleDeletePath = useCallback(
    async (path: string, isDir: boolean) => {
      const name = basename(path);
      if (confirmDelete) {
        const msg = isDir
          ? t(locale, "confirm.deleteFolder", { name })
          : t(locale, "confirm.deleteFile", { name });
        if (!window.confirm(msg)) return;
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
        console.error(e);
      }
    },
    [active, handleNewFile, confirmDelete, locale],
  );

  const handleCreateFileInFolder = useCallback(
    async (parentDir: string, name: string) => {
      const path = joinPath(parentDir, name);
      await api.createFile(path, "");
      setDirTick((t) => t + 1);
      await loadFile(path);
    },
    [loadFile],
  );

  const handleCreateFolderInDir = useCallback(async (parentDir: string, name: string) => {
    const path = joinPath(parentDir, name);
    await api.createDir(path);
    setDirTick((t) => t + 1);
  }, []);

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
    setSidebarVisible(true);
    setSidebarTab(tab);
    persistSidebarTab(tab);
  }, []);

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
      if (disk !== tab.content && tab.dirty) {
        setReloadPrompt(true);
      } else if (disk !== tab.content) {
        markSaved(tab.id, tab.path, disk);
      }
    } catch {
      /* ignore */
    }
  }, [getActive, markSaved]);

  const reloadFromDisk = useCallback(async () => {
    const tab = getActive();
    if (!tab?.path) return;
    const disk = await api.readFile(tab.path);
    markSaved(tab.id, tab.path, disk);
    setReloadPrompt(false);
  }, [getActive, markSaved]);

  useEffect(() => {
    initPlatform();
    applyTheme();
    applyEditorLayoutPrefs();
    let disposed = false;
    const un: Array<() => void> = [];

    if (getRestoreLastFolder()) {
      const savedFolder = getLastFolder();
      if (savedFolder) {
        api
          .listDir(savedFolder)
          .then(() => {
            if (!disposed) setFolderPath(savedFolder);
          })
          .catch(() => clearLastFolder());
      }
    }

    api.onOpenFile((p) => { if (!disposed) loadFile(p); }).then((f) => un.push(f));
    api.onFileChanged(() => { if (!disposed) handleExternalChange(); }).then((f) => un.push(f));
    api.onMenu((action) => {
      if (disposed) return;
      switch (action) {
        case "settings": setSettingsOpen(true); break;
        case "open": openFile(); break;
        case "save": saveTab(); break;
        case "save-as": saveAs(); break;
        case "export-html": exportHtml(); break;
        case "export-pdf": exportPdf(); break;
        case "toggle-sidebar": setSidebarVisible((v) => !v); break;
        case "focus-mode": toggleFocusMode(); break;
        case "typewriter-mode": toggleTypewriterMode(); break;
      }
    }).then((f) => un.push(f));
    api.getStartupFile().then((p) => { if (p && !disposed) loadFile(p); });

    return () => {
      disposed = true;
      un.forEach((f) => f());
      api.unwatchFile();
    };
  }, [loadFile, openFile, saveTab, saveAs, exportHtml, exportPdf, handleExternalChange, toggleFocusMode, toggleTypewriterMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F8") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        toggleTypewriterMode();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "l" && e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (k === "/" || e.key === "?") {
        e.preventDefault();
        toggleEditorMode();
      } else if (k === "s" && e.shiftKey) { e.preventDefault(); saveAs(); }
      else if (k === "s") { e.preventDefault(); saveTab(); }
      else if (k === "o") { e.preventDefault(); openFile(); }
      else if (k === "n") { e.preventDefault(); handleNewFile(); }
      else if (k === "w") { e.preventDefault(); handleCloseFile(); }
      else if (k === ",") { e.preventDefault(); setSettingsOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveTab, saveAs, openFile, handleNewFile, handleCloseFile, toggleFocusMode, toggleTypewriterMode, toggleEditorMode]);

  useEffect(() => {
    const tab = getActive();
    if (!autosave || !tab?.dirty || !tab.path) return;
    const t = setTimeout(() => {
      api.writeFile(tab.path!, tab.content)
        .then(() => markSaved(tab.id, tab.path!, tab.content))
        .catch(console.error);
    }, autosaveDelay);
    return () => clearTimeout(t);
  }, [tabs, autosave, autosaveDelay, getActive, markSaved]);

  useEffect(() => {
    persistFontSize(fontSize);
    persistLineHeight(lineHeight);
    persistEditorMaxWidth(editorMaxWidth);
    persistFocusMaxWidth(focusMaxWidth);
    persistTypewriterPadding(typewriterPadding);
    applyEditorLayoutPrefs();
  }, [fontSize, lineHeight, editorMaxWidth, focusMaxWidth, typewriterPadding]);

  useEffect(() => {
    persistAutosave(autosave);
  }, [autosave]);

  useEffect(() => {
    persistAutosaveDelay(autosaveDelay);
  }, [autosaveDelay]);

  useEffect(() => {
    persistRestoreLastFolder(restoreLastFolder);
  }, [restoreLastFolder]);

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
    if (active?.path) api.watchFile(active.path).catch(console.error);
    else api.unwatchFile();
  }, [active?.path, setTitle]);

  const stats = useMemo(() => {
    const text = active?.content ?? "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return {
      words,
      chars: text.length,
      lines: text.split("\n").length,
      readMin: Math.max(1, Math.ceil(words / 300)),
    };
  }, [active?.content]);

  const outline = useMemo(() => {
    const items: { level: number; text: string; line: number }[] = [];
    (active?.content ?? "").split("\n").forEach((line, i) => {
      const m = /^(#{1,6})\s+(.+)$/.exec(line);
      if (m) items.push({ level: m[1].length, text: m[2], line: i + 1 });
    });
    return items;
  }, [active?.content]);

  const activeOutlineLine = useMemo(() => {
    if (!outline.length) return null;
    let best = outline[0].line;
    for (const h of outline) {
      if (h.line <= cursorLine) best = h.line;
      else break;
    }
    return best;
  }, [outline, cursorLine]);

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
        onToggleFocus={toggleFocusMode}
        onToggleTypewriter={toggleTypewriterMode}
        onOpenSettings={() => setSettingsOpen(true)}
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
              onTab={(t) => {
                setSidebarTab(t);
                persistSidebarTab(t);
              }}
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
            />
          </SidebarPanel>
        )}
        <main className="main">
          {active && (
            <Editor
              ref={editorRef}
              key={active.path ?? active.id}
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
          focusMode={focusMode}
          typewriterMode={typewriterMode}
        />
      )}
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          values={{
            locale,
            theme,
            autosave,
            autosaveDelay,
            restoreLastFolder,
            confirmDiscard,
            confirmDelete,
            recentFilesLimit,
            sidebarVisible,
            defaultSidebarTab,
            defaultEditorMode,
            fontSize,
            lineHeight,
            editorMaxWidth,
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
            onAutosave: setAutosave,
            onAutosaveDelay: setAutosaveDelay,
            onRestoreLastFolder: setRestoreLastFolder,
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
            onEditorMaxWidth: setEditorMaxWidth,
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
    </div>
  );
}
