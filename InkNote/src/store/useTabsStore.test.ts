import { afterEach, describe, expect, it } from "vitest";
import { UTF8_TEXT_ENCODING } from "../lib/textEncoding";
import { useTabsStore } from "./useTabsStore";

afterEach(() => {
  const state = useTabsStore.getState();
  for (const tab of state.tabs) state.closeTab(tab.id);
});

describe("document restoration", () => {
  it("restores the previous editor mode", () => {
    useTabsStore.getState().restoreTab({
      path: null,
      content: "sample",
      diskContent: "sample",
      dirty: false,
      mode: "source",
      encoding: UTF8_TEXT_ENCODING,
    });

    expect(useTabsStore.getState().getActive()?.mode).toBe("source");
  });

  it("can accept preview-only interactions without becoming dirty", () => {
    const state = useTabsStore.getState();
    const id = state.newTab("- [ ] Task");
    state.markSaved(id, undefined, "- [ ] Task");
    state.updateContent(id, "- [x] Task");
    state.markSaved(id, undefined, "- [x] Task");

    expect(useTabsStore.getState().getActive()?.dirty).toBe(false);
  });
});

describe("document identity", () => {
  it("preserves modified documents and per-tab access modes when switching", () => {
    const state = useTabsStore.getState();
    const a = state.openTab("/notes/A.md", "A");
    state.updateContent(a, "unsaved A");
    state.setDocumentOptions(a, { externalDocument: true, documentEditable: false });
    const b = state.openTab("/notes/B.md", "B");
    expect(useTabsStore.getState().tabs).toHaveLength(2);
    expect(useTabsStore.getState().activeId).toBe(b);
    state.activateTab(a);
    expect(useTabsStore.getState().getActive()).toMatchObject({ content: "unsaved A", dirty: true, documentEditable: false });
    expect(state.openTab("/notes/A.md", "old disk content")).toBe(a);
    expect(useTabsStore.getState().getActive()?.content).toBe("unsaved A");
  });

  it("deduplicates Windows paths and closes only the requested tab", () => {
    const state = useTabsStore.getState();
    const a = state.openTab("C:\\notes\\A.md", "A");
    const b = state.newTab("B");
    expect(state.openTab("c:/notes/a.md", "disk A")).toBe(a);
    state.closeTab(b);
    expect(useTabsStore.getState().activeId).toBe(a);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    state.closeTab(a);
    expect(useTabsStore.getState().getActive()).toMatchObject({ path: null, content: "", dirty: false });
  });

  it("saves a background tab without changing the active tab or overwriting newer edits", () => {
    const state = useTabsStore.getState();
    const a = state.openTab("A.md", "A");
    const b = state.newTab("B");
    state.updateContent(a, "newer");
    state.markSaved(a, "A.md", "snapshot");
    expect(useTabsStore.getState().activeId).toBe(b);
    expect(useTabsStore.getState().tabs.find((tab) => tab.id === a)).toMatchObject({ content: "newer", diskContent: "snapshot", dirty: true });
  });

  it("starts a new editor history when another file is opened", () => {
    const initialId = useTabsStore.getState().activeId;

    const openedId = useTabsStore.getState().openTab("B.md", "content B");

    expect(openedId).not.toBe(initialId);
    expect(useTabsStore.getState().getActive()).toMatchObject({
      id: openedId,
      path: "B.md",
      content: "content B",
      dirty: false,
    });
  });

  it("keeps the same editor history for edits and saves within one document", () => {
    const id = useTabsStore.getState().openTab("A.md", "before");

    useTabsStore.getState().updateContent(id, "after");
    useTabsStore.getState().markSaved(id, "A.md", "after");

    expect(useTabsStore.getState().activeId).toBe(id);
    expect(useTabsStore.getState().getActive()).toMatchObject({
      content: "after",
      diskContent: "after",
      dirty: false,
    });
  });

  it("starts a new editor history when a document is restored", () => {
    const initialId = useTabsStore.getState().activeId;

    useTabsStore.getState().restoreTab({
      path: "restored.md",
      content: "restored",
      diskContent: "saved",
      dirty: true,
      mode: "source",
      encoding: UTF8_TEXT_ENCODING,
    });

    expect(useTabsStore.getState().activeId).not.toBe(initialId);
    expect(useTabsStore.getState().getActive()).toMatchObject({
      path: "restored.md",
      content: "restored",
      diskContent: "saved",
      dirty: true,
      mode: "source",
    });
  });

  it("starts a new editor history when disk content replaces the document", () => {
    const id = useTabsStore.getState().openTab("A.md", "old", { name: "GBK", bom: false });

    useTabsStore.getState().loadFromDisk(id, "A.md", "new", { name: "UTF-16LE", bom: true });

    expect(useTabsStore.getState().activeId).toBe(id);
    expect(useTabsStore.getState().getActive()).toMatchObject({
      path: "A.md",
      content: "new",
      diskContent: "new",
      dirty: false,
      encoding: { name: "UTF-16LE", bom: true },
      revision: 1,
    });
  });
});
