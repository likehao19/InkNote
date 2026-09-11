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

let root: Root;
let nextOpen = "";
const files = new Map<string, string>();
const ipc = vi.fn((command: string, args?: Record<string, unknown>) => {
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
});
