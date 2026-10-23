import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { captureSession, parseSession, restoreSession, saveSessionDraft, startSessionBackup } from "./sessionRecovery";
import { useTabsStore } from "../store/useTabsStore";
import { addPendingImage, clearPendingImages, pendingImageUrl, snapshotPendingImages } from "./pendingImages";
import { registerEditorViewState } from "./editorViewState";

const read = vi.fn();
const save = vi.fn();
const write = vi.fn();
const binary = vi.fn();
const remove = vi.fn();

function resetTabs() {
  for (const tab of useTabsStore.getState().tabs) useTabsStore.getState().closeTab(tab.id);
}

beforeEach(() => {
  resetTabs();
  read.mockReset();
  save.mockReset().mockResolvedValue(undefined);
  write.mockReset().mockResolvedValue("new-file");
  binary.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(undefined);
  mockIPC((command, args) => {
    if (command === "read_text_file") return read((args as { path: string }).path);
    if (command === "save_session_backup") return save(args);
    if (command === "write_text_file") return write(args);
    if (command === "write_binary") return binary(args);
    if (command === "remove_path") return remove(args);
    if (command === "list_dir") return [];
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
  it("activates only the saved selection, never intermediate restored documents", async () => {
    const state = useTabsStore.getState();
    const selected = state.openTab("/A.md", "A");
    state.openTab("/B.md", "B");
    state.openTab("/C.md", "C");
    state.activateTab(selected);
    const snapshot = captureSession();
    resetTabs();
    read.mockImplementation((path) => ({ content: path, encoding: { name: "UTF-8", bom: false } }));
    const activePaths: (string | null | undefined)[] = [];
    const unsubscribe = useTabsStore.subscribe((next, previous) => {
      if (next.activeId !== previous.activeId) activePaths.push(next.getActive()?.path);
    });
    try {
      await restoreSession(snapshot, null, () => false);
      expect(activePaths).toEqual(["/A.md"]);
      expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual(["/A.md", "/B.md", "/C.md"]);
    } finally { unsubscribe(); }
  });

  it("keeps a user's newer selection even when it returns to the initial tab", async () => {
    const state = useTabsStore.getState();
    state.openTab("/A.md", "A");
    const snapshot = captureSession();
    resetTabs();
    const welcomeId = state.getActive()!.id;
    read.mockImplementation(() => {
      const other = state.openTab("/user.md", "user document", undefined, undefined, false);
      state.activateTab(other);
      state.activateTab(welcomeId);
      expect(other).not.toBe(welcomeId);
      return { content: "A", encoding: { name: "UTF-8", bom: false } };
    });
    await restoreSession(snapshot, null, () => false, undefined, () => false);
    expect(state.getActive()?.id).toBe(welcomeId);
  });

  it("migrates repeated legacy anonymous copies while keeping named files and their active tab", async () => {
    const state = useTabsStore.getState();
    state.newTab("111");
    state.openTab("/other.md", "other content");
    state.newTab("111");
    state.newTab("111");
    state.openTab("/6666.md", "111");
    const legacy = captureSession();
    delete legacy.legacyUntitledCleaned;
    resetTabs();
    read.mockImplementation((path) => ({ content: path === "/other.md" ? "other content" : "111", encoding: { name: "UTF-8", bom: false } }));
    const result = await restoreSession(legacy, "/6666.md", () => false);
    expect(result.removedDuplicateCount).toBe(3);
    expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual(["/other.md", "/6666.md"]);
    expect(state.getActive()?.path).toBe("/6666.md");
    expect(read).toHaveBeenCalledTimes(2);
    const migrated = captureSession();
    expect(migrated.legacyUntitledCleaned).toBe(true);
    resetTabs();
    const next = await restoreSession(migrated, "/6666.md", () => false);
    expect(next.removedDuplicateCount).toBe(0);
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("keeps unique anonymous content and anonymous copies with pending images during migration", async () => {
    const state = useTabsStore.getState();
    state.newTab("unique unsaved content");
    const withImage = state.newTab("111");
    addPendingImage(".inknote-assets/image.png", new Uint8Array([1, 2]), "image/png", withImage);
    state.openTab("/6666.md", "111");
    const legacy = captureSession();
    delete legacy.legacyUntitledCleaned;
    resetTabs();
    read.mockResolvedValue({ content: "111", encoding: { name: "UTF-8", bom: false } });
    const result = await restoreSession(legacy, "/6666.md", () => false);
    expect(result.removedDuplicateCount).toBe(0);
    expect(useTabsStore.getState().tabs).toHaveLength(3);
    expect(useTabsStore.getState().tabs[0].content).toBe("unique unsaved content");
    expect(snapshotPendingImages(useTabsStore.getState().tabs[1].id)[0].bytes).toEqual(new Uint8Array([1, 2]));
  });

  it("clears already-loaded legacy copies while preserving edits and images added after backup", async () => {
    const state = useTabsStore.getState();
    const edited = state.newTab("111");
    const withImage = state.newTab("111");
    const duplicate = state.newTab("111");
    state.openTab("/saved.md", "111");
    const legacy = captureSession();
    delete legacy.legacyUntitledCleaned;
    state.updateContent(edited, "new unsaved text");
    addPendingImage(".inknote-assets/new.png", new Uint8Array([7]), "image/png", withImage);
    read.mockResolvedValue({ content: "111", encoding: { name: "UTF-8", bom: false } });
    await restoreSession(legacy, "/saved.md", () => false);
    const tabs = useTabsStore.getState().tabs;
    expect(tabs.some((tab) => tab.id === duplicate)).toBe(false);
    expect(tabs.find((tab) => tab.id === edited)?.content).toBe("new unsaved text");
    expect(tabs.some((tab) => tab.id === withImage)).toBe(true);
    expect(tabs).toHaveLength(3);
  });

  it("never removes an anonymous copy based only on a stale named backup", async () => {
    const state = useTabsStore.getState();
    state.newTab("111");
    state.openTab("/missing.md", "111");
    const legacy = captureSession();
    delete legacy.legacyUntitledCleaned;
    resetTabs();
    read.mockRejectedValue("file_not_found");
    const result = await restoreSession(legacy, null, () => false);
    expect(result.removedDuplicateCount).toBe(0);
    expect(state.getActive()?.content).toBe("111");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
  });

  it("keeps intentional untitled copies in sessions created by the fixed version", async () => {
    const state = useTabsStore.getState();
    state.newTab("111");
    state.openTab("/saved.md", "111");
    const current = captureSession();
    resetTabs();
    read.mockResolvedValue({ content: "111", encoding: { name: "UTF-8", bom: false } });
    const result = await restoreSession(current, null, () => false);
    expect(result.removedDuplicateCount).toBe(0);
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

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
  it("uses latest disk content for clean tabs and keeps conflicting content in backup without a tab", async () => {
    const state = useTabsStore.getState();
    const id = state.openTab("/A.md", "original");
    state.updateContent(id, "unsaved draft");
    state.openTab("/B.md", "old clean");
    const snapshot = captureSession();
    resetTabs();
    read.mockImplementation((path) => ({ content: path === "/A.md" ? "externally changed" : "latest clean", encoding: { name: "UTF-8", bom: true } }));
    const recovered = await restoreSession(snapshot, null, () => false);
    expect(recovered.deferredTabs.map((tab) => tab.path)).toEqual(["/A.md"]);
    expect(useTabsStore.getState().tabs.map(({ path, content, dirty }) => ({ path, content, dirty }))).toEqual([
      { path: "/B.md", content: "latest clean", dirty: false },
    ]);
    expect(useTabsStore.getState().getActive()?.path).toBe("/B.md");
  });

  it("restores a dirty startup file without creating a duplicate unnamed tab", async () => {
    const state = useTabsStore.getState();
    const id = state.openTab("C:\\Notes\\A.md", "original");
    state.updateContent(id, "draft");
    const snapshot = captureSession();
    resetTabs();
    read.mockResolvedValue({ content: "original", encoding: { name: "UTF-8", bom: false } });
    await restoreSession(snapshot, "c:/notes/a.md", () => false);
    expect(useTabsStore.getState().getActive()?.path).toBe("C:\\Notes\\A.md");
    expect(useTabsStore.getState().getActive()?.content).toBe("draft");
    useTabsStore.getState().openTab("c:/notes/a.md", "original");
    expect(useTabsStore.getState().tabs.map((tab) => tab.content)).toEqual(["draft"]);
  });

  it("skips missing clean files while restoring genuine untitled attachments", async () => {
    const state = useTabsStore.getState();
    state.openTab("/missing.md", "retained text");
    const id = state.newTab("![](.inknote-assets/image.png)");
    state.setMode(id, "source");
    addPendingImage(".inknote-assets/image.png", new Uint8Array([1, 2, 255]), "image/png", id);
    const snapshot = parseSession(JSON.parse(JSON.stringify(captureSession())))!;
    resetTabs();
    clearPendingImages();
    read.mockRejectedValue("file_not_found");
    await restoreSession(snapshot, null, () => false);
    expect(useTabsStore.getState().tabs.every((tab) => tab.path === null && tab.dirty)).toBe(true);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().getActive()?.mode).toBe("source");
    expect(snapshotPendingImages(useTabsStore.getState().activeId)[0].bytes).toEqual(new Uint8Array([1, 2, 255]));
    expect(pendingImageUrl(".inknote-assets/image.png")).toBe("blob:restored-image");
  });

  it.each(["", "saved content"])("drops a missing unmodified file instead of restoring an unnamed tab: %j", async (content) => {
    useTabsStore.getState().openTab("/1.md", content);
    const snapshot = captureSession();
    resetTabs();
    read.mockRejectedValue("file_not_found");
    const resolve = vi.fn();
    const result = await restoreSession(snapshot, "/2.md", () => false, resolve);
    expect(result.deferredTabs).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
    expect(captureSession().tabs).toEqual([]);
  });

  it("recognizes a renamed startup file by identity and retains its reading position", async () => {
    const state = useTabsStore.getState();
    state.openTab("/1.md", "original", undefined, "identity-1");
    const snapshot = captureSession();
    snapshot.tabs[0].viewState = { anchor: 2, head: 2, scrollAnchor: 0, scrollOffset: 5, scrollLeft: 0 };
    resetTabs();
    read.mockImplementation((path) => path === "/1.md" ? Promise.reject("file_not_found")
      : { content: "original", encoding: { name: "UTF-8", bom: false }, fileIdentity: "identity-1" });
    await restoreSession(snapshot, "/2.md", () => false);
    state.openTab("/2.md", "original");
    expect(state.getActive()?.path).toBe("/2.md");
    expect(state.getActive()?.viewState?.anchor).toBe(2);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
  });

  it("does not merge an unrelated file just because it has identical content", async () => {
    useTabsStore.getState().openTab("/1.md", "", undefined, "identity-1");
    const snapshot = captureSession();
    resetTabs();
    read.mockImplementation((path) => path === "/1.md" ? Promise.reject("file_not_found")
      : { content: "", encoding: { name: "UTF-8", bom: false }, fileIdentity: "identity-2" });
    await restoreSession(snapshot, "/2.md", () => false);
    expect(captureSession().tabs).toEqual([]);
  });

  it("silently drops missing historical files including unsaved backups", async () => {
    const state = useTabsStore.getState();
    const id = state.openTab("/1.md", "original");
    state.updateContent(id, "unsaved");
    const snapshot = captureSession();
    resetTabs();
    read.mockRejectedValue("file_not_found");
    const resolve = vi.fn().mockResolvedValue(null);
    const result = await restoreSession(snapshot, "/2.md", () => false, resolve);
    expect(resolve).not.toHaveBeenCalled();
    expect(result.unavailablePaths).toEqual([]);
    expect(result.deferredTabs).toEqual([]);
    expect(captureSession().tabs).toEqual([]);
    const backup = startSessionBackup(() => true, () => result.deferredTabs);
    try {
      await backup.flush();
      expect(save.mock.calls[0][0].snapshot.tabs).toEqual([]);
    } finally { backup.stop(); }
    const discarded = await restoreSession(snapshot, null, () => false, async () => "discard");
    expect(discarded.deferredTabs).toEqual([]);
    expect(captureSession().tabs).toEqual([]);
  });

  it("discards pathless file-origin backups but preserves genuine new untitled documents", async () => {
    const state = useTabsStore.getState();
    state.openTab("/old.md", "historical file", undefined, "file-1");
    state.newTab("genuine unsaved document");
    const snapshot = captureSession();
    snapshot.tabs[0].path = null;
    resetTabs();
    const resolve = vi.fn();
    const result = await restoreSession(snapshot, null, () => false, resolve);
    expect(useTabsStore.getState().tabs.map((tab) => tab.content)).toEqual(["genuine unsaved document"]);
    expect(result.deferredTabs).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("keeps temporarily unreadable clean files in backup without turning them into drafts", async () => {
    useTabsStore.getState().openTab("/1.md", "saved");
    const snapshot = captureSession();
    resetTabs();
    read.mockRejectedValue("access denied");
    const result = await restoreSession(snapshot, null, () => false);
    expect(result.unavailablePaths).toEqual(["/1.md"]);
    expect(result.deferredTabs[0].dirty).toBe(false);
    expect(captureSession().tabs).toEqual([]);
  });

  it("saves a deferred draft and its pending image without opening a temporary tab", async () => {
    const state = useTabsStore.getState();
    const id = state.newTab("![image](.inknote-assets/image.png)");
    addPendingImage(".inknote-assets/image.png", new Uint8Array([1, 2]), "image/png", id);
    const draft = captureSession().tabs[0];
    resetTabs();
    const saved = await saveSessionDraft(draft, "/elsewhere/saved.md");
    expect(saved).toMatchObject({ path: "/elsewhere/saved.md", dirty: false, fileIdentity: "new-file", pendingImages: [] });
    expect(binary).toHaveBeenCalledWith(expect.objectContaining({ data: [1, 2] }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ path: "/elsewhere/saved.md", content: expect.stringContaining("recovered-") }));
    expect(captureSession().tabs).toEqual([]);
    write.mockRejectedValueOnce(new Error("disk full"));
    await expect(saveSessionDraft(draft, "/elsewhere/fail.md")).rejects.toThrow("disk full");
    expect(remove).toHaveBeenCalled();
    expect(draft.pendingImages[0].bytes).toEqual([1, 2]);
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

  it("does not lose a deferred draft when its original path is also open in another tab", async () => {
    const state = useTabsStore.getState();
    const id = state.openTab("/A.md", "original");
    state.updateContent(id, "deferred unsaved content");
    const snapshot = captureSession();
    resetTabs();
    state.openTab("/A.md", "original");
    read.mockResolvedValue({ content: "original", encoding: { name: "UTF-8", bom: false } });
    const result = await restoreSession(snapshot, null, () => false);
    expect(state.getActive()?.content).toBe("original");
    expect(result.deferredTabs[0].content).toBe("deferred unsaved content");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
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
