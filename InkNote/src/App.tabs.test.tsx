import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import App from "./App";
import { useTabsStore } from "./store/useTabsStore";
import { resetSettingsStoreForTests } from "./lib/settingsStore";
import { NATIVE_MENU_EVENT } from "./lib/nativeMenu";
import { setRestoreLastFile } from "./lib/preferences";
import type { SessionSnapshot } from "./lib/sessionRecovery";

let root: Root;
let nextOpen = "";
let session: SessionSnapshot | null = null;
let backupFails = false;
let startupPath: string | null = null;
const files = new Map<string, string>();
const ipc = vi.fn((command: string, args?: Record<string, unknown>) => {
  if (command === "load_session_backup") return session;
  if (command === "save_session_backup") {
    if (backupFails) throw new Error("disk full");
    session = args?.snapshot as SessionSnapshot | null;
  }
  if (command === "get_startup_file") return startupPath;
  if (command === "plugin:dialog|open") return nextOpen;
  if (command === "read_text_file") return { content: files.get(String(args?.path)) ?? "", encoding: { name: "UTF-8", bom: false } };
  if (command === "write_text_file") files.set(String(args?.path), String(args?.content));
  if (command === "list_dir") return [];
  if (command === "plugin:window|scale_factor") return 1;
  return null;
});

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
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
  });
}

function activeView() {
  const element = document.querySelector('.document-editor-panel:not(.is-inactive) .cm-editor') as HTMLElement;
  return EditorView.findFromDOM(element)!;
}

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((item) => item.textContent === text || item.getAttribute("aria-label") === text);
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
  for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
  files.clear();
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
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("multi-document workflows", () => {
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

  it("checks every dirty tab before destroying the window", async () => {
    setRestoreLastFile(false);
    for (const path of ["/notes/A.md", "/notes/B.md"]) {
      await openFile(path);
      await act(async () => activeView().dispatch({ changes: { from: 0, insert: "edited " }, userEvent: "input.type" }));
    }
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    await clickButton("取消");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(false);
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    await clickButton("保存");
    await clickButton("保存");
    expect(files.get("/notes/A.md")).toBe("edited A original");
    expect(files.get("/notes/B.md")).toBe("edited B original");
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(true);
  });

  it("backs up and restores all tabs and unsaved drafts without writing originals", async () => {
    await openFile("/notes/A.md");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "draft " }, userEvent: "input.type" }));
    await openFile("/notes/B.md");
    await menu("new");
    await act(async () => activeView().dispatch({ changes: { from: 0, insert: "untitled draft" }, userEvent: "input.type" }));
    const contents = useTabsStore.getState().tabs.map((tab) => tab.content);
    await act(async () => { await emit("tauri://close-requested"); });
    await settle();
    expect(ipc.mock.calls.some(([command]) => command === "plugin:window|destroy")).toBe(true);
    expect(ipc.mock.calls.some(([command]) => command === "write_text_file")).toBe(false);
    expect(session?.tabs.map((tab) => tab.content)).toEqual(contents);
    expect(session?.activeIndex).toBe(2);
    await act(async () => root.unmount());
    for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<App />));
    await vi.waitFor(() => expect(useTabsStore.getState().tabs.map((tab) => tab.content)).toEqual(contents));
    expect(useTabsStore.getState().tabs.map((tab) => tab.dirty)).toEqual([true, false, true]);
    expect(useTabsStore.getState().getActive()?.content).toBe("untitled draft");
    expect(files.get("/notes/A.md")).toBe("A original");
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
