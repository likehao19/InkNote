import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { captureSession, parseSession, restoreSession, startSessionBackup } from "./sessionRecovery";
import { useTabsStore } from "../store/useTabsStore";
import { addPendingImage, clearPendingImages, pendingImageUrl, snapshotPendingImages } from "./pendingImages";
import { registerEditorViewState } from "./editorViewState";

const read = vi.fn();
const save = vi.fn();

function resetTabs() {
  for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
}

beforeEach(() => {
  resetTabs();
  read.mockReset();
  save.mockReset().mockResolvedValue(undefined);
  mockIPC((command, args) => {
    if (command === "read_text_file") return read((args as { path: string }).path);
    if (command === "save_session_backup") return save(args);
    return null;
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restored-image");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  clearPendingImages();
  clearMocks();
  vi.restoreAllMocks();
});

describe("session recovery", () => {
  it("captures and restores reading positions without requiring them in older backups", async () => {
    const id = useTabsStore.getState().newTab("draft");
    const viewState = { anchor: 2, head: 4, scrollAnchor: 0, scrollOffset: 12, scrollLeft: 5 };
    const unregister = registerEditorViewState(id, () => viewState);
    const snapshot = captureSession();
    unregister();
    resetTabs();
    await restoreSession(parseSession(JSON.parse(JSON.stringify(snapshot)))!, null, () => false);
    expect(useTabsStore.getState().getActive()?.viewState).toEqual(viewState);
    delete snapshot.tabs[0].viewState;
    expect(parseSession(snapshot)?.tabs[0].viewState).toBeUndefined();
    snapshot.tabs[0].viewState = { ...viewState, anchor: -1 };
    expect(parseSession(snapshot)?.tabs[0].viewState).toBeUndefined();
  });
  it("uses latest disk content for clean tabs and detaches drafts when the original changed", async () => {
    const state = useTabsStore.getState();
    const id = state.openTab("/A.md", "original");
    state.updateContent(id, "unsaved draft");
    state.openTab("/B.md", "old clean");
    const snapshot = captureSession();
    resetTabs();
    read.mockImplementation((path) => ({ content: path === "/A.md" ? "externally changed" : "latest clean", encoding: { name: "UTF-8", bom: true } }));
    const recovered = await restoreSession(snapshot, null, () => false);
    expect(recovered).toEqual(["/A.md"]);
    expect(useTabsStore.getState().tabs.map(({ path, content, dirty }) => ({ path, content, dirty }))).toEqual([
      { path: null, content: "unsaved draft", dirty: true },
      { path: "/B.md", content: "latest clean", dirty: false },
    ]);
    expect(useTabsStore.getState().getActive()?.path).toBe("/B.md");
  });

  it("keeps an external startup file separate from its saved draft", async () => {
    const state = useTabsStore.getState();
    const id = state.openTab("C:\\Notes\\A.md", "original");
    state.updateContent(id, "draft");
    const snapshot = captureSession();
    resetTabs();
    read.mockResolvedValue({ content: "original", encoding: { name: "UTF-8", bom: false } });
    await restoreSession(snapshot, "c:/notes/a.md", () => false);
    expect(useTabsStore.getState().getActive()?.path).toBeNull();
    expect(useTabsStore.getState().getActive()?.content).toBe("draft");
    useTabsStore.getState().openTab("c:/notes/a.md", "original");
    expect(useTabsStore.getState().tabs.map((tab) => tab.content)).toEqual(["draft", "original"]);
  });

  it("recovers missing files and untitled attachments with new image URLs", async () => {
    const state = useTabsStore.getState();
    state.openTab("/missing.md", "retained text");
    const id = state.newTab("![](.inknote-assets/image.png)");
    state.setMode(id, "source");
    addPendingImage(".inknote-assets/image.png", new Uint8Array([1, 2, 255]), "image/png", id);
    const snapshot = parseSession(JSON.parse(JSON.stringify(captureSession())))!;
    resetTabs();
    clearPendingImages();
    read.mockRejectedValue(new Error("missing"));
    await restoreSession(snapshot, null, () => false);
    expect(useTabsStore.getState().tabs.every((tab) => tab.path === null && tab.dirty)).toBe(true);
    expect(useTabsStore.getState().getActive()?.mode).toBe("source");
    expect(snapshotPendingImages(useTabsStore.getState().activeId)[0].bytes).toEqual(new Uint8Array([1, 2, 255]));
    expect(pendingImageUrl(".inknote-assets/image.png")).toBe("blob:restored-image");
  });

  it("rejects malformed backups", () => {
    expect(() => parseSession({ version: 2, tabs: [], activeIndex: 0 })).toThrow();
    expect(() => parseSession({ version: 1, tabs: [null], activeIndex: 0 })).toThrow();
    expect(parseSession(null)).toBeNull();
  });

  it("does not restore after disposal or replace live contents already opened", async () => {
    const state = useTabsStore.getState();
    state.openTab("/A.md", "original");
    const snapshot = captureSession();
    read.mockResolvedValue({ content: "original", encoding: { name: "UTF-8", bom: false } });
    resetTabs();
    await restoreSession(snapshot, null, () => true);
    expect(useTabsStore.getState().tabs[0].path).toBeNull();
    const live = state.openTab("/A.md", "original");
    state.updateContent(live, "live edit");
    await restoreSession(snapshot, null, () => false);
    expect(useTabsStore.getState().getActive()?.content).toBe("live edit");
  });

  it("flushes edits made during a write and retries after a failed backup", async () => {
    const id = useTabsStore.getState().newTab("first");
    const backup = startSessionBackup(() => true);
    try {
      save.mockImplementationOnce(() => { useTabsStore.getState().updateContent(id, "latest"); });
      await backup.flush();
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][0].snapshot.tabs[0].content).toBe("latest");
      save.mockRejectedValueOnce(new Error("disk full"));
      await expect(backup.flush()).rejects.toThrow("disk full");
      await backup.flush();
    } finally { backup.stop(); }
  });
});
