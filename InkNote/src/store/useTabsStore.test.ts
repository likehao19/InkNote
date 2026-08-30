import { afterEach, describe, expect, it } from "vitest";
import { useTabsStore } from "./useTabsStore";

afterEach(() => {
  const state = useTabsStore.getState();
  state.closeTab(state.activeId);
});

describe("document restoration", () => {
  it("restores the previous editor mode", () => {
    useTabsStore.getState().restoreTab({
      path: null,
      content: "sample",
      diskContent: "sample",
      dirty: false,
      mode: "source",
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
    const id = useTabsStore.getState().openTab("A.md", "old");

    useTabsStore.getState().loadFromDisk(id, "A.md", "new");

    expect(useTabsStore.getState().activeId).not.toBe(id);
    expect(useTabsStore.getState().getActive()).toMatchObject({
      path: "A.md",
      content: "new",
      diskContent: "new",
      dirty: false,
    });
  });
});
