import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyEditorLayoutPrefs,
  getEditorWidthPreset,
  setEditorZoom,
  setEditorWidthPreset,
  setFontSize,
} from "./preferences";
import { resetSettingsStoreForTests } from "./settingsStore";

describe("editor content layout", () => {
  beforeEach(() => resetSettingsStoreForTests());

  afterEach(() => {
    resetSettingsStoreForTests();
    document.documentElement.style.removeProperty("--editor-max-width");
    document.documentElement.style.removeProperty("--editor-render-font-size");
  });

  it("uses the full-width layout by default", () => {
    expect(getEditorWidthPreset()).toBe("full");
    applyEditorLayoutPrefs();
    expect(document.documentElement.style.getPropertyValue("--editor-max-width")).toBe("95vw");
  });

  it("persists and applies a selected layout preset", () => {
    setEditorWidthPreset("compact");
    expect(getEditorWidthPreset()).toBe("compact");
    applyEditorLayoutPrefs();
    expect(document.documentElement.style.getPropertyValue("--editor-max-width")).toBe("46rem");
  });

  it("applies editor zoom to the rendered font size", () => {
    setFontSize(16);
    setEditorZoom(125);
    applyEditorLayoutPrefs();
    expect(document.documentElement.style.getPropertyValue("--editor-render-font-size")).toBe("20px");
  });
});
