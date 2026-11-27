import { beforeEach, describe, expect, it } from "vitest";
import {
  MARKDOWN_THEMES,
  applyMarkdownTheme,
  getMarkdownTheme,
  isMarkdownTheme,
  setMarkdownTheme,
} from "./markdownTheme";
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

    setMarkdownTheme("pixyll");
    expect(getMarkdownTheme()).toBe("pixyll");
    expect(document.documentElement.dataset.mdTheme).toBe("pixyll");

    setMarkdownTheme("vue");
    expect(getMarkdownTheme()).toBe("vue");
    expect(document.documentElement.dataset.mdTheme).toBe("vue");
  });

  it("supports all Typora classic and curated themes", () => {
    const ids = MARKDOWN_THEMES.map((item) => item.id);
    for (const id of ["pixyll", "github", "newsprint", "whitey", "night", "lapis", "sepia", "nord", "academic", "vue", "minimal"] as const) {
      expect(ids).toContain(id);
      expect(isMarkdownTheme(id)).toBe(true);
      setMarkdownTheme(id);
      expect(getMarkdownTheme()).toBe(id);
      expect(document.documentElement.dataset.mdTheme).toBe(id);
    }
    expect(isMarkdownTheme("not-a-theme")).toBe(false);
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
