import { beforeEach, describe, expect, it } from "vitest";
import {
  getStoredValue,
  initializeSettingsStore,
  resetSettingsStoreForTests,
} from "./settingsStore";
import { getLocale } from "./i18n";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
  });

  it("uses English when no language has been selected", () => {
    expect(getLocale()).toBe("en");
  });

  it("preserves an explicitly selected legacy language", async () => {
    localStorage.setItem("inknote.locale", "zh");

    await initializeSettingsStore();

    expect(getLocale()).toBe("zh");
    expect(localStorage.getItem("inknote.locale")).toBeNull();
  });

  it("migrates legacy workspace values out of localStorage", async () => {
    localStorage.setItem("mdnote.lastFolder", "D:\\notes");

    await initializeSettingsStore();

    expect(getStoredValue("mdnote.lastFolder")).toBe("D:\\notes");
    expect(localStorage.getItem("mdnote.lastFolder")).toBeNull();
  });
});
