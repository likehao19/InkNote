import { beforeEach, describe, expect, it } from "vitest";
import { applyMarkdownTheme, getMarkdownTheme, setMarkdownTheme } from "./markdownTheme";
import { resetSettingsStoreForTests, setStoredValue } from "./settingsStore";

describe("Markdown theme preference", () => {
  beforeEach(() => {
    resetSettingsStoreForTests();
    document.documentElement.removeAttribute("data-md-theme");
  });

  it("defaults to GitHub and applies a selected theme", () => {
    expect(getMarkdownTheme()).toBe("github");
    applyMarkdownTheme();
    expect(document.documentElement.dataset.mdTheme).toBe("github");

    setMarkdownTheme("vue");
    expect(getMarkdownTheme()).toBe("vue");
    expect(document.documentElement.dataset.mdTheme).toBe("vue");
  });

  it("ignores unsupported persisted values", () => {
    setStoredValue("mdnote.markdownTheme", "unknown");
    expect(getMarkdownTheme()).toBe("github");
  });

  it("migrates the previous theme names", () => {
    setStoredValue("mdnote.markdownTheme", "paper");
    expect(getMarkdownTheme()).toBe("vue");
  });
});
