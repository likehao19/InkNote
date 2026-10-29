import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import App from "./App";
import { useTabsStore } from "./store/useTabsStore";
import { resetSettingsStoreForTests } from "./lib/settingsStore";
import { NATIVE_MENU_EVENT } from "./lib/nativeMenu";
import { setRestoreLastFile } from "./lib/preferences";
import * as fileApi from "./lib/tauri";
import { captureSession, type SessionSnapshot } from "./lib/sessionRecovery";
import { getWorkspaceFolders } from "./lib/workspace";

let root: Root;
beforeAll(async () => { await import("./components/Editor"); });
let nextOpen = "";
let session: SessionSnapshot | null = null;
let backupFails = false;
let startupPath: string | null = null;
let nextSave: string | null = null;
const files = new Map<string, string>();
const directories = new Set<string>();
const identities = new Map<string, string>();
const ipc = vi.fn((command: string, args?: Record<string, unknown>) => {
  if (command === "load_session_backup") return session;
  if (command === "save_session_backup") {
    if (backupFails) throw new Error("disk full");
    session = args?.snapshot as SessionSnapshot | null;
  }
  if (command === "get_startup_file") return startupPath;
  if (command === "plugin:dialog|open") return nextOpen;
  if (command === "plugin:dialog|save") return nextSave;
  if (command === "read_text_file") {
    const path = String(args?.path);
    if (!files.has(path)) throw "file_not_found";
    return { content: files.get(path), encoding: { name: "UTF-8", bom: false }, fileIdentity: identities.get(path) };
  }
  if (command === "find_renamed_file") {
    const path = String(args?.path);
    if (files.has(path)) return null;
    const parent = path.slice(0, path.lastIndexOf("/"));
    const matches = [...files.keys()].filter((candidate) => candidate.slice(0, candidate.lastIndexOf("/")) === parent
      && identities.get(candidate) === args?.identity);
    return matches.length === 1 ? matches[0] : null;
  }
  if (command === "write_text_file") {
    const path = String(args?.path);
    if (args?.expectedContent !== undefined) {
      if (!files.has(path)) throw "file_not_found";
      if (files.get(path) !== args.expectedContent) throw "file_changed";
    }
    files.set(path, String(args?.content));
  }
  if (command === "list_dir") return [];
  if (command === "is_directory") {
    const path = String(args?.path);
    if (directories.has(path)) return true;
    if (files.has(path)) return false;
    throw new Error("Missing dropped path");
  }
  if (command === "plugin:window|scale_factor") return 1;
  return null;
});

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
}

async function restart(beforeMount?: () => void) {
  await act(async () => root.unmount());
  for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
  beforeMount?.();
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
  await settle();
}

async function waitForPath(path: string) {
  await vi.waitFor(async () => {
    await settle();
    expect(useTabsStore.getState().getActive()?.path).toBe(path);
  });
}

async function menu(action: string) {
  await act(async () => { window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENT, { detail: action })); });
  await settle();
}

async function openFile(path: string) {
  nextOpen = path;
  await menu("open");
  await vi.waitFor(() => expect(useTabsStore.getState().getActive()?.path).toBe(path));
  await vi.waitFor(async () => {
    await settle();
    expect(document.querySelector('.document-editor-panel:not(.is-inactive) .cm-editor')).not.toBeNull();
  }, { timeout: 5000, interval: 100 });
}

function activeView() {
  const element = document.querySelector('.document-editor-panel:not(.is-inactive) .cm-editor') as HTMLElement;
  return EditorView.findFromDOM(element)!;
}

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((item) => item.textContent === text || item.getAttribute("aria-label") === text
      || item.querySelector(".document-tab-name")?.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
  await settle();
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  resetSettingsStoreForTests();
  session = null;
  backupFails = false;
  startupPath = null;
  nextSave = null;
  // Each simulated restart gets a fresh process's startup path, rather than
  // reusing the production module's StrictMode-safe cached promise.
  vi.spyOn(fileApi, "getStartupFile").mockImplementation(async () => startupPath);
  for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
  files.clear();
  directories.clear();
  identities.clear();
  files.set("/notes/A.md", "A original");
  files.set("/notes/B.md", "B original");
  ipc.mockClear();
  mockWindows("main");
  mockIPC((command, payload) => ipc(command, payload as Record<string, unknown> | undefined), { shouldMockEvents: true });
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
  await settle();
});

afterEach(async () => {
  await act(async () => root.unmount());
  await settle();
  clearMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("external folder drops", () => {
  async function drop(paths: string[], target: Element | null = null) {
    vi.spyOn(document, "elementFromPoint").mockReturnValue(target);
    await act(async () => { await emit("tauri://drag-drop", { paths, position: { x: 100, y: 100 } }); });
    await settle();
  }

  it("loads multiple folders into an empty sidebar and deduplicates repeated drops", async () => {
    directories.add("/notes");
    directories.add("/中文 notes");
    await menu("sidebar-outline");
    await drop(["/notes", "/中文 notes", "/notes"]);
    expect(getWorkspaceFolders()).toEqual(["/notes", "/中文 notes"]);
    expect(document.querySelectorAll(".tree-root-row")).toHaveLength(2);
    expect(document.querySelector(".sidebar .tab.active")?.textContent).toBe("文件");
    expect(ipc).toHaveBeenCalledWith("watch_dirs", { paths: ["/notes", "/中文 notes"] });
    await drop(["/notes"]);
    expect(getWorkspaceFolders()).toEqual(["/notes", "/中文 notes"]);
  });

  it("keeps click-to-open and adds dropped folders without copying them into an existing root", async () => {
    nextOpen = "/notes";
    await menu("open-folder");
    directories.add("/archive.md");
    const rootRow = document.querySelector(".tree-root-row");
    expect(rootRow).not.toBeNull();
    await drop(["/archive.md"], rootRow);
    expect(getWorkspaceFolders()).toEqual(["/notes", "/archive.md"]);
    expect(ipc.mock.calls.some(([command]) => command.startsWith("copy_file_to_dir"))).toBe(false);
    expect(ipc).not.toHaveBeenCalledWith("read_text_file", { path: "/archive.md" });
  });

  it("still opens a dropped Markdown file and handles a mixed folder/file drop", async () => {
    await drop(["/notes/A.md"]);
    await waitForPath("/notes/A.md");
    directories.add("/notes");
    await drop(["/notes", "/notes/B.md"]);
    await waitForPath("/notes/B.md");
    expect(getWorkspaceFolders()).toEqual(["/notes"]);
  });

  it("reports unavailable paths without preventing other folders from loading", async () => {
    directories.add("/notes");
    await drop(["/missing", "/notes"]);
    expect(getWorkspaceFolders()).toEqual(["/notes"]);
    expect(document.body.textContent).toContain("Missing dropped path");
  });
});

describe("multi-document workflows", () => {
  it("shows the external startup document before slow history restores without intermediate tab activation", async () => {
    await openFile("/notes/A.md");
    await openFile("/notes/B.md");
    session = captureSession();
    files.set("/notes/new.md", "new document");
    files.set("/notes/second.md", "second document");
    startupPath = "/notes/new.md";
    let finishRead!: (file: fileApi.TextFileContent) => void;
    const pending = new Promise<fileApi.TextFileContent>((resolve) => { finishRead = resolve; });
    const originalRead = fileApi.readTextFile;
    vi.spyOn(fileApi, "readTextFile").mockImplementation((path) => path === "/notes/A.md" ? pending : originalRead(path));
    const activated: string[] = [];
    let unsubscribe = () => {};
    try {
      await restart(() => {
        unsubscribe = useTabsStore.subscribe((state, previous) => {
          if (state.activeId !== previous.activeId && state.getActive()?.path) activated.push(state.getActive()!.path!);
        });
      });
      await waitForPath("/notes/new.md");
      expect(activated).toEqual(["/notes/new.md"]);
      // Further external opens remain usable while restoration is still reading.
      await act(async () => { await emit("open-file", "/notes/second.md"); });
      await waitForPath("/notes/second.md");
      await clickButton("new.md");
      await act(async () => finishRead({ content: "A original", encoding: { name: "UTF-8", bom: false } }));
      await settle();
      expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual(["/notes/A.md", "/notes/B.md", "/notes/new.md", "/notes/second.md"]);
      expect(useTabsStore.getState().getActive()?.path).toBe("/notes/new.md");
      expect(activated).toEqual(["/notes/new.md", "/notes/second.md", "/notes/new.md"]);
    } finally {
      finishRead({ content: "A original", encoding: { name: "UTF-8", bom: false } });
      unsubscribe();
    }
  });

  it("does not override a manually selected historical tab while normal startup is restoring", async () => {
    await openFile("/notes/A.md");
    await openFile("/notes/B.md");
    session = captureSession();
    let finishRead!: (file: fileApi.TextFileContent) => void;
    const pending = new Promise<fileApi.TextFileContent>((resolve) => { finishRead = resolve; });
    const originalRead = fileApi.readTextFile;
    vi.spyOn(fileApi, "readTextFile").mockImplementation((path) => path === "/notes/B.md" ? pending : originalRead(path));
    try {
      await restart();
      await vi.waitFor(() => expect(document.querySelector(".document-tab-name")?.textContent).toBe("未命名"));
      await clickButton("A.md");
      await act(async () => finishRead({ content: "B original", encoding: { name: "UTF-8", bom: false } }));
      await settle();
      expect(useTabsStore.getState().getActive()?.path).toBe("/notes/A.md");
      expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual(["/notes/A.md", "/notes/B.md"]);
    } finally { finishRead({ content: "B original", encoding: { name: "UTF-8", bom: false } }); }
  });

  it.each([false, true])("follows repeated external renames in the same tab, preserving dirty content: %s", async (dirty) => {
    identities.set("/notes/A.md", "identity-A");
    await openFile("/notes/A.md");
    const id = useTabsStore.getState().activeId;
    if (dirty) await act(async () => useTabsStore.getState().updateContent(id, "local edits"));
    let previous = "/notes/A.md";
    for (const name of ["renamed", "renamed-again"]) {
      const path = `/notes/${name}.md`;
      files.delete(previous);
      files.set(path, "A original");
      identities.set(path, "identity-A");
      await act(async () => { await emit("file-changed", previous); });
      await vi.waitFor(async () => {
        await settle();
        expect(useTabsStore.getState().getActive()?.path).toBe(path);
      });
      expect(useTabsStore.getState().tabs).toHaveLength(1);
      expect(useTabsStore.getState().getActive()).toMatchObject({ id, content: dirty ? "local edits" : "A original", dirty });
      expect(document.querySelector(".document-tab-name")?.textContent).toBe(`${name}.md`);
      expect(document.querySelector(".document-tab-error")).toBeNull();
      previous = path;
    }
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(files.get(previous)).toBe(dirty ? "local edits" : "A original");
    expect(files.has("/notes/A.md")).toBe(false);
    expect(session?.tabs.map((tab) => tab.path)).toEqual([previous]);
  });

  it("reuses the original dirty tab when the renamed file is opened before the watcher fires", async () => {
    identities.set("/notes/A.md", "identity-A");
    await openFile("/notes/A.md");
    const id = useTabsStore.getState().activeId;
    await act(async () => useTabsStore.getState().updateContent(id, "local edits"));
    files.delete("/notes/A.md");
    files.set("/notes/new.md", "A original");
    identities.set("/notes/new.md", "identity-A");
    await openFile("/notes/new.md");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().getActive()).toMatchObject({ id, path: "/notes/new.md", content: "local edits", dirty: true });
  });

  it("updates a background tab's filename without changing the active document", async () => {
    identities.set("/notes/A.md", "identity-A");
    await openFile("/notes/A.md");
    const id = useTabsStore.getState().activeId;
    await openFile("/notes/B.md");
    files.delete("/notes/A.md");
    files.set("/notes/new.md", "A original");
    identities.set("/notes/new.md", "identity-A");
    await act(async () => { await emit("file-changed", "/notes/A.md"); });
    await vi.waitFor(async () => {
      await settle();
      expect(useTabsStore.getState().tabs.find((tab) => tab.id === id)?.path).toBe("/notes/new.md");
    });
    expect(useTabsStore.getState().getActive()?.path).toBe("/notes/B.md");
  });

  it("ignores a previous window's delayed watcher registration", async () => {
    let finishWatch!: () => void;
    vi.spyOn(fileApi, "watchFiles").mockImplementationOnce(() => new Promise((resolve) => { finishWatch = resolve; }));
    await openFile("/notes/A.md");
    await restart();
    await openFile("/notes/A.md");
    await act(async () => useTabsStore.getState().updateContent(useTabsStore.getState().activeId, "local edits"));
    files.set("/notes/A.md", "external edits");
    await act(async () => finishWatch());
    await settle();
    expect(useTabsStore.getState().getActive()?.externalStatus).toBeUndefined();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await vi.waitFor(async () => {
      await settle();
      expect(useTabsStore.getState().getActive()?.externalStatus).toBe("conflict");
      expect(document.querySelector(".modal-actions")?.textContent).toContain("保留当前");
    });
  });

  it("does not mistake a same-content copy for a rename", async () => {
    identities.set("/notes/A.md", "identity-A");
    await openFile("/notes/A.md");
    files.delete("/notes/A.md");
    files.set("/notes/copy.md", "A original");
    identities.set("/notes/copy.md", "identity-copy");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await settle();
    expect(useTabsStore.getState().getActive()).toMatchObject({ path: "/notes/A.md", externalStatus: "unavailable" });
  });

  it("watches and synchronizes clean foreground and background documents", async () => {
    await openFile("/notes/A.md");
    await openFile("/notes/B.md");
    const ids = useTabsStore.getState().tabs.map((tab) => tab.id);
    expect(ipc.mock.calls.some(([command, args]) => command === "watch_file"
      && JSON.stringify(args?.paths) === JSON.stringify(["/notes/A.md", "/notes/B.md"]))).toBe(true);
    files.set("/notes/A.md", "# A externally updated");
    files.set("/notes/B.md", "# B externally updated");
    await act(async () => { await emit("file-changed", "/notes/A.md"); });
    await vi.waitFor(async () => {
      await settle();
      expect(useTabsStore.getState().tabs.map((tab) => tab.content)).toEqual(["# A externally updated", "# B externally updated"]);
    });
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(ids);
    expect(useTabsStore.getState().tabs.every((tab) => !tab.dirty)).toBe(true);
    expect(activeView().state.doc.toString()).toBe("# B externally updated");
    expect(useTabsStore.getState().getActive()?.path).toBe("/notes/B.md");
  });

  it("rechecks missed external changes on focus and tab activation", async () => {
    await openFile("/notes/A.md");
    await openFile("/notes/B.md");
    files.set("/notes/B.md", "updated while unfocused");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await settle();
    expect(useTabsStore.getState().getActive()?.content).toBe("updated while unfocused");
    files.set("/notes/A.md", "updated without an event");
    await clickButton("A.md");
    expect(useTabsStore.getState().getActive()?.content).toBe("updated without an event");
  });

  it("keeps local edits on external conflict and refuses to overwrite disk on close", async () => {
    await openFile("/notes/A.md");
    const id = useTabsStore.getState().activeId;
    await act(async () => useTabsStore.getState().updateContent(id, "local edits"));
    files.set("/notes/A.md", "external edits");
    await act(async () => { await emit("file-changed", "/notes/A.md"); });
    await vi.waitFor(async () => {
      await settle();
      expect(useTabsStore.getState().getActive()?.externalStatus).toBe("conflict");
    });
    expect(useTabsStore.getState().getActive()?.content).toBe("local edits");
    await clickButton("保留当前");
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(files.get("/notes/A.md")).toBe("external edits");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(false);
    expect(document.querySelector(".document-tab-error")).not.toBeNull();
  });

  it("does not discard edits made while an external read is in flight", async () => {
    await openFile("/notes/A.md");
    let finishRead!: (value: Awaited<ReturnType<typeof fileApi.readTextFile>>) => void;
    vi.spyOn(fileApi, "readTextFile").mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => {
      useTabsStore.getState().updateContent(useTabsStore.getState().activeId, "typed during read");
      finishRead({ content: "external update", encoding: { name: "UTF-8", bom: false } });
    });
    await settle();
    expect(useTabsStore.getState().getActive()?.content).toBe("typed during read");
    expect(useTabsStore.getState().getActive()?.externalStatus).toBe("conflict");
  });

  it("retains an unavailable tab when identity cannot confirm a rename, without recreating its old path", async () => {
    await openFile("/notes/A.md");
    const oldId = useTabsStore.getState().activeId;
    await act(async () => useTabsStore.getState().updateContent(oldId, "local edits"));
    files.delete("/notes/A.md");
    files.set("/notes/renamed.md", "A original");
    await openFile("/notes/renamed.md");
    await vi.waitFor(() => expect(useTabsStore.getState().tabs.find((tab) => tab.id === oldId)?.externalStatus).toBe("unavailable"));
    await clickButton("A.md");
    expect(useTabsStore.getState().getActive()?.path).toBe("/notes/A.md");
    expect(useTabsStore.getState().getActive()?.content).toBe("local edits");
    expect(useTabsStore.getState().tabs.some((tab) => !tab.path)).toBe(false);
    await menu("save");
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(files.has("/notes/A.md")).toBe(false);
    expect(files.get("/notes/renamed.md")).toBe("A original");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(false);
    nextSave = "/notes/salvaged.md";
    await menu("save-as");
    expect(files.get("/notes/salvaged.md")).toBe("local edits");
    expect(useTabsStore.getState().getActive()?.externalStatus).toBeUndefined();
  });

  it("does not restore an untitled document discarded when closing", async () => {
    await menu("new");
    await act(async () => useTabsStore.getState().updateContent(useTabsStore.getState().activeId, "discard this"));
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    await clickButton("不保存");
    expect(session?.tabs.some((tab) => tab.content === "discard this")).toBe(false);
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(true);
  });

  it("removes historical rename copies automatically and does not bring them back on restart", async () => {
    files.set("/notes/6666.md", "111");
    await openFile("/notes/A.md");
    await act(async () => {
      const state = useTabsStore.getState();
      state.newTab("111");
      state.newTab("111");
      state.newTab("111");
      state.openTab("/notes/6666.md", "111");
    });
    session = captureSession();
    delete session.legacyUntitledCleaned;
    startupPath = "/notes/6666.md";
    await restart();
    await waitForPath("/notes/6666.md");
    expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual(["/notes/A.md", "/notes/6666.md"]);
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(2);
    await act(async () => { await emit("tauri://close-requested"); });
    expect(session?.legacyUntitledCleaned).toBe(true);
    expect(session?.tabs).toHaveLength(2);
    await restart();
    await waitForPath("/notes/6666.md");
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("opens a renamed external file in one tab across repeated restarts", async () => {
    files.set("/notes/1.md", "original");
    identities.set("/notes/1.md", "file-1");
    await openFile("/notes/1.md");
    session = captureSession();
    files.delete("/notes/1.md");
    files.set("/notes/2.md", "original");
    identities.set("/notes/2.md", "file-1");
    startupPath = "/notes/2.md";
    await restart();
    await waitForPath("/notes/2.md");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(1);
    await act(async () => { await emit("tauri://close-requested"); });
    expect(session?.tabs.map((tab) => tab.path)).toEqual(["/notes/2.md"]);
    await restart();
    await waitForPath("/notes/2.md");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
  });

  it("silently removes a missing historical file without creating an unnamed tab or recovery dialog", async () => {
    files.set("/notes/1.md", "original");
    await openFile("/notes/1.md");
    await act(async () => useTabsStore.getState().updateContent(useTabsStore.getState().activeId, "unsaved"));
    session = captureSession();
    files.delete("/notes/1.md");
    files.set("/notes/2.md", "new document");
    startupPath = "/notes/2.md";
    nextSave = "/notes/saved.md";
    await restart();
    await waitForPath("/notes/2.md");
    expect(document.querySelector(".modal-text")).toBeNull();
    expect(document.querySelector(".toast")).toBeNull();
    expect(useTabsStore.getState().tabs.some((tab) => tab.content === "unsaved")).toBe(false);
    expect(useTabsStore.getState().tabs.every((tab) => tab.path !== null)).toBe(true);
    await act(async () => { await emit("tauri://close-requested"); });
    const pending = session!.tabs.find((tab) => tab.path === "/notes/1.md");
    expect(pending).toBeUndefined();
    expect(files.has("/notes/saved.md")).toBe(false);
  });

  it("previews search matches without stealing focus or changing document content", async () => {
    files.set("/notes/A.md", "first needle\nsecond needle\nlast needle");
    await openFile("/notes/A.md");
    await menu("find");
    const input = await vi.waitFor(() => {
      const element = document.querySelector<HTMLInputElement>('.document-search-modal input[type="search"]');
      expect(element).not.toBeNull();
      return element!;
    });
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, "needle");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    const view = activeView();
    expect(view.state.selection.main.from).toBe(6);
    expect(view.state.selection.main.to).toBe(12);
    expect(document.activeElement).toBe(input);
    expect(view.dom.querySelector(".cm-document-search-match")?.textContent).toBe("needle");
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(view.state.selection.main.from).toBe(20);
    expect(document.activeElement).toBe(input);
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); });
    expect(view.state.selection.main.from).toBe(6);
    await act(async () => {
      setValue.call(input, "missing");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.dom.querySelector(".cm-document-search-match")).toBeNull();
    expect(useTabsStore.getState().getActive()?.dirty).toBe(false);
    expect(view.state.doc.toString()).toBe(files.get("/notes/A.md"));
  });

  it("copies the right-clicked background tab path", async () => {
    await openFile("/notes/A.md");
    await openFile("/notes/B.md");
    await tabMenu("/notes/A.md", "复制绝对路径");
    expect(ipc).toHaveBeenCalledWith("plugin:clipboard-manager|write_text", expect.objectContaining({ text: "/notes/A.md" }));
    expect(useTabsStore.getState().getActive()?.path).toBe("/notes/B.md");
  });

  it("disables copying the path of an unsaved document", async () => {
    await menu("new");
    const tab = document.querySelector('[role="tab"]')!;
    await act(async () => { tab.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })); });
    const item = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((button) => button.textContent === "复制绝对路径");
    expect(item?.disabled).toBe(true);
  });

  async function tabMenu(path: string, label: string) {
    const tab = useTabsStore.getState().tabs.find((item) => item.path === path)!;
    await act(async () => document.getElementById(`tab-${tab.id}`)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 60 })));
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) => item.textContent === label);
    expect(item).toBeDefined();
    await act(async () => item!.click());
    await settle();
  }

  it("closes other tabs relative to the right-clicked background tab", async () => {
    await openFile("/notes/A.md");
    await openFile("/notes/B.md");
    await tabMenu("/notes/A.md", "关闭其他标签");
    expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual(["/notes/A.md"]);
    expect(useTabsStore.getState().getActive()?.path).toBe("/notes/A.md");
  });

  it("stops closing all tabs on cancel and supports saving before continuing", async () => {
    await openFile("/notes/A.md");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "edited " }, userEvent: "input.type" }));
    await openFile("/notes/B.md");
    await tabMenu("/notes/B.md", "关闭全部标签");
    await clickButton("取消");
    expect(useTabsStore.getState().tabs).toHaveLength(2);
    await tabMenu("/notes/B.md", "关闭全部标签");
    await clickButton("保存");
    expect(files.get("/notes/A.md")).toBe("edited A original");
    expect(useTabsStore.getState().tabs.some((tab) => tab.path)).toBe(false);
  });

  it("keeps the editor instance, selection and undo history across tab switches", async () => {
    await openFile("/notes/A.md");
    const a = activeView();
    await act(async () => a.dispatch({ changes: { from: 0, insert: "edited " }, selection: { anchor: 3 }, userEvent: "input.type" }));
    await openFile("/notes/B.md");
    expect(activeView()).not.toBe(a);
    await clickButton("A.md●");
    expect(activeView()).toBe(a);
    expect(a.state.selection.main.head).toBe(3);
    await act(async () => { undo(a); });
    expect(useTabsStore.getState().getActive()?.content).toBe("A original");
    await openFile("/notes/A.md");
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("cancels or discards a background tab close without losing the active document", async () => {
    await openFile("/notes/A.md");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "edited " }, userEvent: "input.type" }));
    await openFile("/notes/B.md");
    await clickButton("关闭 A.md");
    await clickButton("取消");
    expect(useTabsStore.getState().tabs).toHaveLength(2);
    await clickButton("关闭 A.md");
    await clickButton("不保存");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().getActive()?.path).toBe("/notes/B.md");
    expect(files.get("/notes/A.md")).toBe("A original");
    await menu("reopen-closed");
    expect(useTabsStore.getState().getActive()?.content).toBe("edited A original");
  });

  it("automatically saves every named dirty tab before destroying the window", async () => {
    setRestoreLastFile(false);
    for (const path of ["/notes/A.md", "/notes/B.md"]) {
      await openFile(path);
      await act(async () => activeView().dispatch({ changes: { from: 0, insert: "edited " }, userEvent: "input.type" }));
    }
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(files.get("/notes/A.md")).toBe("edited A original");
    expect(files.get("/notes/B.md")).toBe("edited B original");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(true);
  });

  it("saves named documents and asks before closing an untitled document", async () => {
    await openFile("/notes/A.md");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "draft " }, userEvent: "input.type" }));
    await openFile("/notes/B.md");
    await menu("new");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "untitled draft" }, userEvent: "input.type" }));
    const contents = useTabsStore.getState().tabs.map((tab) => tab.content);
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(files.get("/notes/A.md")).toBe("draft A original");
    await clickButton("取消");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(false);
    nextSave = "/notes/new.md";
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    await clickButton("保存");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(true);
    expect(session?.tabs.map((tab) => tab.content)).toEqual(contents);
    expect(session?.activeIndex).toBe(2);
    await act(async () => root.unmount());
    for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<App />));
    await vi.waitFor(() => expect(useTabsStore.getState().tabs.map((tab) => tab.content)).toEqual(contents));
    expect(useTabsStore.getState().tabs.map((tab) => tab.dirty)).toEqual([false, false, false]);
    expect(useTabsStore.getState().getActive()?.content).toBe("untitled draft");
    expect(files.get("/notes/A.md")).toBe("draft A original");
  });

  it("keeps the window open if the session backup fails", async () => {
    await openFile("/notes/A.md");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "draft " }, userEvent: "input.type" }));
    backupFails = true;
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(false);
    expect(useTabsStore.getState().getActive()?.content).toBe("draft A original");
    backupFails = false;
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(true);
  });
});
