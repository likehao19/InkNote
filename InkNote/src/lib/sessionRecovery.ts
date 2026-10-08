import { invoke } from "@tauri-apps/api/core";
import { useTabsStore, sameDocumentPath, type TabDoc } from "../store/useTabsStore";
import { snapshotPendingImages, restorePendingImages } from "./pendingImages";
import { readTextFile } from "./tauri";

type SessionTab = Omit<TabDoc, "id" | "revision"> & {
  pendingImages: { relPath: string; mime: string; bytes: number[] }[];
};

export interface SessionSnapshot {
  version: 1;
  activeIndex: number;
  tabs: SessionTab[];
}

export function captureSession(): SessionSnapshot {
  const state = useTabsStore.getState();
  const tabs = state.tabs.filter((tab) => !tab.sampleDocument && (tab.path || tab.content || tab.welcomeDismissed));
  return {
    version: 1,
    activeIndex: Math.max(0, tabs.findIndex((tab) => tab.id === state.activeId)),
    tabs: tabs.map(({ id, revision: _revision, ...tab }) => ({
      ...tab,
      pendingImages: snapshotPendingImages(id).map((image) => ({ ...image, bytes: Array.from(image.bytes) })),
    })),
  };
}

export function parseSession(value: unknown): SessionSnapshot | null {
  if (value === null || value === undefined) return null;
  const session = value as SessionSnapshot;
  if (session.version !== 1 || !Array.isArray(session.tabs) || !Number.isInteger(session.activeIndex)) {
    throw new Error("Invalid session backup");
  }
  for (const tab of session.tabs) {
    if (!tab || (tab.path !== null && typeof tab.path !== "string") || typeof tab.content !== "string"
      || typeof tab.diskContent !== "string" || typeof tab.dirty !== "boolean"
      || !["source", "preview"].includes(tab.mode) || typeof tab.encoding?.name !== "string"
      || typeof tab.encoding.bom !== "boolean" || typeof tab.externalDocument !== "boolean"
      || typeof tab.documentEditable !== "boolean" || typeof tab.sampleDocument !== "boolean"
      || typeof tab.welcomeDismissed !== "boolean" || !Array.isArray(tab.pendingImages)) {
      throw new Error("Invalid session document");
    }
    for (const image of tab.pendingImages) {
      if (typeof image.relPath !== "string" || typeof image.mime !== "string" || !Array.isArray(image.bytes)
        || !image.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        throw new Error("Invalid session image");
      }
    }
  }
  return session;
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  return parseSession(await invoke("load_session_backup"));
}

/** Read disk first; changed or missing originals become separate unsaved drafts. */
export async function restoreSession(
  snapshot: SessionSnapshot,
  startupPath: string | null,
  disposed: () => boolean,
): Promise<string[]> {
  const recoveredPaths: string[] = [];
  const ids: string[] = [];
  for (const saved of snapshot.tabs) {
    let tab = { ...saved };
    if (tab.path) {
      const originalPath = tab.path;
      try {
        const disk = await readTextFile(tab.path);
        if (disposed()) return recoveredPaths;
        if (tab.dirty && (disk.content !== tab.diskContent
          || (startupPath && sameDocumentPath(startupPath, tab.path)))) {
          recoveredPaths.push(tab.path);
          tab = { ...tab, path: null, diskContent: "", dirty: true, externalDocument: false, documentEditable: true };
        } else if (!tab.dirty) {
          tab = { ...tab, content: disk.content, diskContent: disk.content, encoding: disk.encoding };
        }
      } catch {
        if (disposed()) return recoveredPaths;
        recoveredPaths.push(originalPath);
        tab = { ...tab, path: null, diskContent: "", dirty: Boolean(tab.content), externalDocument: false, documentEditable: true };
      }
    }
    if (disposed()) return recoveredPaths;
    const state = useTabsStore.getState();
    // A file opened while restoration was reading disk keeps its live editor state.
    const existing = tab.path && state.tabs.find((item) => item.path && sameDocumentPath(item.path, tab.path!));
    const id = state.restoreTab(tab);
    if (!existing) {
      state.setDocumentOptions(id, {
        externalDocument: tab.externalDocument,
        documentEditable: tab.documentEditable,
        welcomeDismissed: tab.welcomeDismissed,
      });
      restorePendingImages(tab.pendingImages.map((image) => ({ ...image, bytes: new Uint8Array(image.bytes) })), id);
    }
    ids.push(id);
  }
  if (!disposed() && ids[snapshot.activeIndex]) useTabsStore.getState().activateTab(ids[snapshot.activeIndex]);
  return recoveredPaths;
}

/** Debounce drafts, serialize writes, and wait for the latest snapshot before exit. */
export function startSessionBackup(enabled: () => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  const save = () => {
    const snapshot = enabled() ? captureSession() : null;
    chain = chain.catch(() => undefined).then(() => invoke("save_session_backup", { snapshot }));
    return chain;
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void save().catch((error) => console.error("Session backup failed", error)); }, 700);
  };
  const unsubscribe = useTabsStore.subscribe((state, previous) => {
    if (state.tabs !== previous.tabs || state.activeId !== previous.activeId) schedule();
  });
  schedule();
  return {
    async flush() {
      let state;
      do {
        clearTimeout(timer);
        state = useTabsStore.getState();
        await save();
      } while (state.tabs !== useTabsStore.getState().tabs || state.activeId !== useTabsStore.getState().activeId);
    },
    stop() { clearTimeout(timer); unsubscribe(); },
  };
}
