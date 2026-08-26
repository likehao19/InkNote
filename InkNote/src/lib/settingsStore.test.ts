import { beforeEach, describe, expect, it } from "vitest";
import {
  getStoredValue,
  initializeSettingsStore,
  resetSettingsStoreForTests,
} from "./settingsStore";
import { getLocale } from "./i18n";
import {
  clearLastFileUnder,
  getWorkspaceFolders,
  getLastFile,
  remapLastFile,
  setLastFile,
  setLastFolder,
  setWorkspaceFolders,
} from "./workspace";
import { addRecentFile, getRecentFiles, remapRecentFiles, removeRecentFilesUnder } from "./recent";
import { getTreeExpansion, removeTreeExpansion, setTreeExpansion } from "./treeState";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
  });

  it("uses Chinese when no language has been selected", () => {
    expect(getLocale()).toBe("zh");
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

  it("removes the retired session recovery snapshot", async () => {
    localStorage.setItem("mdnote.sessionRecovery", "stale draft");

    await initializeSettingsStore();

    expect(localStorage.getItem("mdnote.sessionRecovery")).toBeNull();
    expect(getStoredValue("mdnote.sessionRecovery")).toBeNull();
  });

  it("upgrades a legacy single folder and persists multiple workspace roots", () => {
    setLastFolder("D:\\legacy");
    expect(getWorkspaceFolders()).toEqual(["D:\\legacy"]);

    setWorkspaceFolders(["D:\\docs", "D:\\notes", "D:\\docs"]);
    expect(getWorkspaceFolders()).toEqual(["D:\\docs", "D:\\notes"]);
    expect(getStoredValue("mdnote.lastFolder")).toBe("D:\\notes");
  });

  it("keeps recent and restored paths in sync after folder rename or deletion", () => {
    addRecentFile("D:\\notes\\guide.md");
    setLastFile("D:\\notes\\nested\\draft.md");

    remapRecentFiles("D:\\notes", "D:\\archive");
    remapLastFile("D:\\notes", "D:\\archive");
    expect(getRecentFiles()).toEqual(["D:\\archive\\guide.md"]);
    expect(getLastFile()).toBe("D:\\archive\\nested\\draft.md");

    removeRecentFilesUnder("D:\\archive");
    clearLastFileUnder("D:\\archive");
    expect(getRecentFiles()).toEqual([]);
    expect(getLastFile()).toBeNull();
  });

  it("persists file-tree expansion independently for each workspace root", () => {
    setTreeExpansion("D:\\docs", {
      rootExpanded: false,
      expanded: ["D:\\docs\\guide"],
    });
    expect(getTreeExpansion("D:\\docs")).toEqual({
      rootExpanded: false,
      expanded: ["D:\\docs\\guide"],
    });
    expect(getTreeExpansion("D:\\other")).toEqual({ rootExpanded: true, expanded: [] });

    removeTreeExpansion("D:\\docs");
    expect(getTreeExpansion("D:\\docs")).toEqual({ rootExpanded: true, expanded: [] });
  });
});
