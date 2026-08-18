import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Editor, { type EditorRef } from "./components/Editor";
import Titlebar from "./components/Titlebar";
import Sidebar, { type SidebarTab } from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Settings from "./components/Settings";
import ReloadDialog from "./components/ReloadDialog";
import PromptDialog from "./components/PromptDialog";
import * as api from "./lib/tauri";
import { initPlatform } from "./lib/platform";
import { addRecentFile, getRecentFiles } from "./lib/recent";
import {
  getLastFolder,
  setLastFolder,
  clearLastFolder,
  getSidebarTab,
  setSidebarTab as persistSidebarTab,
} from "./lib/workspace";
import { apply as applyTheme, getThemePref, resolveTheme, setThemePref, type ThemePref } from "./lib/theme";
import { markdownToHtml, printHtml } from "./render/export";
import { parseFrontMatter, updateFrontMatter } from "./lib/frontmatter";
import { dirOf, joinPath, basename } from "./lib/paths";
import { useTabsStore } from "./store/useTabsStore";

const AUTOSAVE_MS = 1200;

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
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [dirTick, setDirTick] = useState(0);
  const [recentFiles, setRecentFiles] = useState(getRecentFiles);
  const [reloadPrompt, setReloadPrompt] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [prompt, setPrompt] = useState<{
    title: string;
    label: string;
    defaultValue?: string;
    onOk: (v: string) => void;
  } | null>(null);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem("mdnote.fontSize")) || 15);
  const [autosave, setAutosave] = useState(() => localStorage.getItem("mdnote.autosave") !== "off");

  const fileName = useMemo(() => {
    if (!active?.path) return "未命名";
    return active.path.split(/[\\/]/).pop() || active.path;
  }, [active?.path]);

  const setTitle = useCallback((path: string | null) => {
    const name = path ? path.split(/[\\/]/).pop() || path : "未命名";
    getCurrentWindow().setTitle(`${name} — MDNote`);
  }, []);

  const confirmDiscard = useCallback(() => {
    const tab = getActive();
    if (!tab?.dirty) return true;
    return window.confirm("当前文件有未保存的更改，确定放弃？");
  }, [getActive]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!confirmDiscard()) return;
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
    [openTab, setTitle, confirmDiscard],
  );

  const openFile = useCallback(async () => {
    if (!confirmDiscard()) return;
    const p = await api.openFileDialog();
    if (p) await loadFile(p);
  }, [loadFile, confirmDiscard]);

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
    if (!confirmDiscard()) return;
    newTab();
    setTitle(null);
  }, [newTab, setTitle, confirmDiscard]);

  const handleCloseFile = useCallback(() => {
    const tab = getActive();
    if (!tab) return;
    if (tab.dirty && !window.confirm("当前文件有未保存的更改，确定关闭？")) return;
    closeTab(tab.id);
    setTitle(null);
  }, [getActive, closeTab, setTitle]);

  const handleRenamePath = useCallback(
    (path: string, isDir: boolean) => {
      const base = basename(path);
      setPrompt({
        title: isDir ? "重命名文件夹" : "重命名",
        label: isDir ? "新文件夹名" : "新文件名",
        defaultValue: base,
        onOk: async (name) => {
          setPrompt(null);
          if (!name || name === base) return;
          const parent = dirOf(path);
          const newPath = joinPath(parent, name);
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
      });
    },
    [active, markSaved],
  );

  const handleDeletePath = useCallback(
    async (path: string, isDir: boolean) => {
      const name = basename(path);
      const label = isDir ? `文件夹「${name}」及其内容` : `文件「${name}」`;
      if (!window.confirm(`确定删除${label}？`)) return;
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
    [active, handleNewFile],
  );

  const handleNewFileInFolder = useCallback(
    (parentDir: string) => {
      setPrompt({
        title: "新建文件",
        label: "文件名",
        defaultValue: "未命名.md",
        onOk: async (name) => {
          setPrompt(null);
          if (!name) return;
          const path = joinPath(parentDir, name);
          try {
            await api.createFile(path, "");
            setDirTick((t) => t + 1);
            await loadFile(path);
          } catch (e) {
            console.error(e);
          }
        },
      });
    },
    [loadFile],
  );

  const handleNewFolderInDir = useCallback((parentDir: string) => {
    setPrompt({
      title: "新建文件夹",
      label: "文件夹名",
      defaultValue: "新建文件夹",
      onOk: async (name) => {
        setPrompt(null);
        if (!name) return;
        const path = joinPath(parentDir, name);
        try {
          await api.createDir(path);
          setDirTick((t) => t + 1);
        } catch (e) {
          console.error(e);
        }
      },
    });
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
    let disposed = false;
    const un: Array<() => void> = [];

    // 恢复上次打开的文件夹
    const savedFolder = getLastFolder();
    if (savedFolder) {
      api
        .listDir(savedFolder)
        .then(() => {
          if (!disposed) setFolderPath(savedFolder);
        })
        .catch(() => clearLastFolder());
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
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s" && e.shiftKey) { e.preventDefault(); saveAs(); }
      else if (k === "s") { e.preventDefault(); saveTab(); }
      else if (k === "o") { e.preventDefault(); openFile(); }
      else if (k === "n") { e.preventDefault(); handleNewFile(); }
      else if (k === "w") { e.preventDefault(); handleCloseFile(); }
      else if (k === ",") { e.preventDefault(); setSettingsOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveTab, saveAs, openFile, handleNewFile, handleCloseFile]);

  useEffect(() => {
    const tab = getActive();
    if (!autosave || !tab?.dirty || !tab.path) return;
    const t = setTimeout(() => {
      api.writeFile(tab.path!, tab.content)
        .then(() => markSaved(tab.id, tab.path!, tab.content))
        .catch(console.error);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [tabs, autosave, getActive, markSaved]);

  useEffect(() => {
    document.documentElement.style.setProperty("--editor-font-size", `${fontSize}px`);
    localStorage.setItem("mdnote.fontSize", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("mdnote.autosave", autosave ? "on" : "off");
  }, [autosave]);

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
        fileName={fileName}
        dirty={active?.dirty ?? false}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        sidebarVisible={sidebarVisible}
        onOpen={openFile}
        onOpenFolder={openFolder}
        onNewFile={handleNewFile}
        onCloseFile={handleCloseFile}
        onSave={() => saveTab()}
        onSaveAs={saveAs}
        onExportHtml={exportHtml}
        onExportPdf={exportPdf}
        onToggleSidebar={() => setSidebarVisible((v) => !v)}
        onToggleFocus={toggleFocusMode}
        onToggleTypewriter={toggleTypewriterMode}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="app-body">
        {sidebarVisible && !focusMode && (
          <Sidebar
            tab={sidebarTab}
            onTab={(t) => {
              setSidebarTab(t);
              persistSidebarTab(t);
            }}
            folderPath={folderPath}
            dirTick={dirTick}
            onOpenPath={(p) => loadFile(p)}
            onRefreshTree={() => setDirTick((t) => t + 1)}
            onNewFileInDir={folderPath ? handleNewFileInFolder : undefined}
            onNewFolderInDir={folderPath ? handleNewFolderInDir : undefined}
            onRenamePath={folderPath ? handleRenamePath : undefined}
            onDeletePath={folderPath ? handleDeletePath : undefined}
            outline={outline}
            activeOutlineLine={activeOutlineLine}
            onOutlineClick={scrollToHeading}
            currentPath={active?.path ?? null}
            recentFiles={recentFiles}
          />
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
              onChange={handleChange}
              onModeChange={handleModeChange}
              onCursorLine={setCursorLine}
            />
          )}
        </main>
      </div>
      <StatusBar
        mode={active?.mode ?? "preview"}
        stats={stats}
        path={active?.path ?? null}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
      />
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onTheme={(t) => { setTheme(t); setThemePref(t); }}
          fontSize={fontSize}
          onFontSize={setFontSize}
          autosave={autosave}
          onAutosave={setAutosave}
          frontMatter={frontMatterData}
          onFrontMatter={handleFrontMatter}
        />
      )}
      {prompt && (
        <PromptDialog
          title={prompt.title}
          label={prompt.label}
          defaultValue={prompt.defaultValue}
          onConfirm={prompt.onOk}
          onCancel={() => setPrompt(null)}
        />
      )}
      {reloadPrompt && (
        <ReloadDialog onReload={reloadFromDisk} onDismiss={() => setReloadPrompt(false)} />
      )}
    </div>
  );
}
