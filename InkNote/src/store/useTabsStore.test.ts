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
