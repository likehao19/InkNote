import { invoke } from "@tauri-apps/api/core";
import { useTabsStore, sameDocumentPath, type TabDoc } from "../store/useTabsStore";
import { snapshotPendingImages, restorePendingImages } from "./pendingImages";
import { readTextFile, writeTextFile, writeBinary, removePath, MissingFileError } from "./tauri";
import { readEditorViewState, validEditorViewState } from "./editorViewState";
import { prepareManagedImagesForSaveAs } from "./documentAssets";
import { extractManagedImageReferences, rewriteManagedImageReferences, IMAGE_ASSET_DIR } from "./imageAssets";
import { basename, dirOf, joinPath } from "./paths";
import { UTF8_TEXT_ENCODING } from "./textEncoding";

export type SessionTab = Omit<TabDoc, "id" | "revision" | "externalStatus"> & {
  pendingImages: { relPath: string; mime: string; bytes: number[] }[];
};

export interface SessionSnapshot {
  version: 1;
  legacyUntitledCleaned?: boolean;
  activeIndex: number;
  tabs: SessionTab[];
}

export function captureSession(deferredTabs: SessionTab[] = []): SessionSnapshot {
  const state = useTabsStore.getState();
  const tabs = state.tabs.filter((tab) => !tab.sampleDocument && (tab.path || tab.content || tab.welcomeDismissed));
  return {
    version: 1,
    legacyUntitledCleaned: true,
    activeIndex: Math.max(0, tabs.findIndex((tab) => tab.id === state.activeId)),
    tabs: [...tabs.map(({ id, revision: _revision, externalStatus: _externalStatus, ...tab }) => ({
      ...tab,
      viewState: readEditorViewState(id) ?? tab.viewState,
      pendingImages: snapshotPendingImages(id).map((image) => ({ ...image, bytes: Array.from(image.bytes) })),
    })), ...deferredTabs],
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
    // Older backups have no reading position. A bad optional position must not
    // prevent recovery of the document itself.
    if (!validEditorViewState(tab.viewState)) delete tab.viewState;
    if (typeof tab.fileIdentity !== "string") delete tab.fileIdentity;
  }
  return session;
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  return parseSession(await invoke("load_session_backup"));
}

export interface SessionRestoreResult {
  recoveredPaths: string[];
  deferredTabs: SessionTab[];
  unavailablePaths: string[];
  removedDuplicateCount: number;
}

/** null postpones a draft without opening a tab; discard is always explicit. */
export type ResolveSessionDraft = (tab: SessionTab) => Promise<SessionTab | "discard" | null>;

/** Save directly from the backup; never create a temporary editor tab. */
export async function saveSessionDraft(tab: SessionTab, path: string): Promise<SessionTab> {
  const created: string[] = [];
  let managed: Awaited<ReturnType<typeof prepareManagedImagesForSaveAs>> | undefined;
  try {
    const references = extractManagedImageReferences(tab.content);
    const replacements = new Map<string, string>();
    for (const image of tab.pendingImages) {
      const matches = references.filter((reference) => reference.fileName.toLowerCase() === basename(image.relPath).toLowerCase());
      if (!matches.length) continue;
      const extension = /\.[a-z0-9]+$/i.exec(image.relPath)?.[0] ?? ".png";
      const relative = `${IMAGE_ASSET_DIR}/recovered-${crypto.randomUUID()}${extension}`;
      const absolute = joinPath(dirOf(path), relative);
      await writeBinary(absolute, image.bytes);
      created.push(absolute);
      for (const match of matches) replacements.set(match.source, relative);
    }
    managed = await prepareManagedImagesForSaveAs(tab.path, path, rewriteManagedImageReferences(tab.content, replacements));
    const fileIdentity = await writeTextFile(path, managed.content, UTF8_TEXT_ENCODING);
    return { ...tab, path, content: managed.content, diskContent: managed.content, dirty: false,
      fileIdentity: fileIdentity ?? undefined, encoding: UTF8_TEXT_ENCODING, pendingImages: [],
      externalDocument: false, documentEditable: true };
  } catch (error) {
    await managed?.rollback();
    for (const createdPath of created) { try { await removePath(createdPath); } catch { /* Keep the save error. */ } }
    throw error;
  }
}

export async function restoreSession(
  snapshot: SessionSnapshot,
  startupPath: string | null,
  disposed: () => boolean,
  resolveDraft?: ResolveSessionDraft,
  canActivate: () => boolean = () => true,
): Promise<SessionRestoreResult> {
  const initial = useTabsStore.getState().getActive();
  const initialActiveId = useTabsStore.getState().activeId;
  const restoreSelection = !startupPath && !initial?.path && !initial?.content && !initial?.welcomeDismissed;
  const result: SessionRestoreResult = { recoveredPaths: [], deferredTabs: [], unavailablePaths: [], removedDuplicateCount: 0 };
  const ids: (string | undefined)[] = [];
  const reads = new Map<string, ReturnType<typeof readTextFile>>();
  const readDisk = (path: string) => {
    if (!reads.has(path)) reads.set(path, readTextFile(path));
    return reads.get(path)!;
  };
  // Older versions detached missing files into anonymous drafts. Migrate exact
  // duplicates whose text is still saved on disk, never drafts with attachments.
  // The marker leaves intentionally created untitled copies alone after migration
  // and keeps the backup format readable by earlier versions.
  const legacyDuplicates = new Set<SessionTab>();
  const orphanedFiles = new Set(snapshot.tabs.filter((tab) => !tab.path && (tab.fileIdentity || tab.externalDocument)));
  if (!snapshot.legacyUntitledCleaned && snapshot.tabs.some((tab) => !tab.path && !tab.pendingImages.length)) {
    const paths = new Set(snapshot.tabs.flatMap((tab) => tab.path ? [tab.path] : []));
    if (startupPath) paths.add(startupPath);
    const contents = await Promise.all([...paths].map(async (path) => {
      try { return (await readDisk(path)).content; } catch { return null; }
    }));
    if (disposed()) return result;
    const savedContents = new Set(contents.filter((content): content is string => content !== null));
    for (const tab of snapshot.tabs) {
      if (!tab.path && !tab.pendingImages.length && savedContents.has(tab.content)) legacyDuplicates.add(tab);
    }
    // Also remove copies already loaded in memory (for example after a dev
    // reload). Keep any tab edited or given attachments since the backup.
    const duplicateContents = new Set([...legacyDuplicates].map((tab) => tab.content));
    const state = useTabsStore.getState();
    for (const tab of state.tabs) {
      if (!tab.path && !tab.sampleDocument && duplicateContents.has(tab.content) && !snapshotPendingImages(tab.id).length) {
        state.closeTab(tab.id);
      }
    }
  }
  for (const saved of snapshot.tabs) {
    if (legacyDuplicates.has(saved) || orphanedFiles.has(saved)) {
      result.removedDuplicateCount++;
      ids.push(undefined);
      continue;
    }
    let tab = { ...saved };
    let conflict = false;
    if (tab.path) {
      const originalPath = tab.path;
      let disk: Awaited<ReturnType<typeof readTextFile>> | undefined;
      try {
        disk = await readDisk(tab.path);
      } catch (error) {
        if (disposed()) return result;
        const missing = error instanceof MissingFileError;
        if (missing && tab.fileIdentity && startupPath && !sameDocumentPath(startupPath, originalPath)) {
          try {
            const opened = await readDisk(startupPath);
            if (opened.fileIdentity === tab.fileIdentity) {
              disk = opened;
              tab.path = startupPath;
            }
          } catch { /* The normal external-open flow reports startup file errors. */ }
        }
        if (!disk) {
          // A renamed/deleted historical file must not return as an anonymous
          // draft or a recurring recovery prompt when its new path is unknown.
          if (missing) {
            ids.push(undefined);
            continue;
          }
          result.unavailablePaths.push(originalPath);
          if (!tab.dirty) {
            result.deferredTabs.push(tab);
            ids.push(undefined);
            continue;
          }
          conflict = true;
        }
      }
      if (disposed()) return result;
      if (disk) {
        conflict = tab.dirty && disk.content !== tab.diskContent;
        if (!conflict) {
          tab.fileIdentity = disk.fileIdentity;
          if (!tab.dirty) tab = { ...tab, content: disk.content, diskContent: disk.content, encoding: disk.encoding };
        }
      }
    }
    const live = tab.path && useTabsStore.getState().tabs.find((item) => item.path && sameDocumentPath(item.path, tab.path!));
    if (tab.dirty && live && live.content !== tab.content) conflict = true;
    if (conflict) {
      const resolved = resolveDraft ? await resolveDraft(tab) : null;
      if (disposed()) return result;
      if (resolved === "discard" || !resolved) {
        if (!resolved) result.deferredTabs.push(tab);
        ids.push(undefined);
        continue;
      }
      result.recoveredPaths.push(resolved.path!);
      tab = resolved;
    }
    if (disposed()) return result;
    const state = useTabsStore.getState();
    // A file opened while restoration was reading disk keeps its live editor state.
    const existing = tab.path && state.tabs.find((item) => item.path && sameDocumentPath(item.path, tab.path!));
    const id = state.restoreTab(tab, false);
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
  if (!disposed()) {
    const state = useTabsStore.getState();
    const selectionUnchanged = canActivate() && state.activeId === initialActiveId;
    const restoredIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const restoredTabs = restoredIds.flatMap((id) => state.tabs.find((tab) => tab.id === id) ?? []);
    const tabs = [...restoredTabs, ...state.tabs.filter((tab) => !restoredIds.includes(tab.id)
      && (tab.path || tab.content || tab.welcomeDismissed || (!selectionUnchanged && tab.id === state.activeId)))];
    if (tabs.length) {
      const savedActiveId = ids[snapshot.activeIndex] ?? restoredIds[0];
      const activeId = restoreSelection && selectionUnchanged ? savedActiveId : state.activeId;
      // Commit ordering and selection once. Background restoration must not
      // activate each document or replace a user's newer selection.
      useTabsStore.setState({ tabs, activeId: tabs.some((tab) => tab.id === activeId) ? activeId! : savedActiveId ?? tabs[0].id });
    }
  }
  return result;
}

/** Debounce drafts, serialize writes, and wait for the latest snapshot before exit. */
export function startSessionBackup(enabled: () => boolean, deferredTabs: () => SessionTab[] = () => []) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  const save = () => {
    const snapshot = enabled() ? captureSession(deferredTabs()) : null;
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
