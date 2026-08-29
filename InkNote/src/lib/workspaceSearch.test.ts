import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDir: vi.fn(),
  readFile: vi.fn(),
  searchRegex: vi.fn(),
}));

vi.mock("./tauri", () => ({
  listDir: mocks.listDir,
  readFile: mocks.readFile,
  searchRegex: mocks.searchRegex,
}));

import { invalidateWorkspaceFileCache, listWorkspaceFiles, searchWorkspace } from "./workspaceSearch";

describe("workspace search", () => {
  beforeEach(() => {
    mocks.listDir.mockReset();
    mocks.readFile.mockReset();
    mocks.searchRegex.mockReset();
    invalidateWorkspaceFileCache();
  });

  it("searches the full content of Markdown files larger than 500 KB", async () => {
    mocks.listDir.mockResolvedValue([
      { name: "ReleaseNotes.md", path: "D:\\notes\\ReleaseNotes.md", is_dir: false },
    ]);
    mocks.readFile.mockResolvedValue(`${"x".repeat(512_001)}\nrelease content`);

    const result = await searchWorkspace(["D:\\notes"], [], "release content");

    expect(result.fileCount).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      path: "D:\\notes\\ReleaseNotes.md",
      line: 2,
      lineText: "release content",
    });
  });

  it("does not cap workspace files or results and ignores non-Markdown files", async () => {
    const markdownFiles = Array.from({ length: 2101 }, (_, index) => ({
      name: `note-${index}.md`,
      path: `D:\\notes\\note-${index}.md`,
      is_dir: false,
    }));
    mocks.listDir.mockResolvedValue([
      ...markdownFiles,
      { name: "notes.txt", path: "D:\\notes\\notes.txt", is_dir: false },
    ]);
    mocks.readFile.mockResolvedValue("needle\nneedle");

    const result = await searchWorkspace(["D:\\notes"], [], "needle");

    expect(result.fileCount).toBe(2101);
    expect(result.matches).toHaveLength(4202);
    expect(mocks.readFile).toHaveBeenCalledTimes(2101);
  });

  it("refreshes the file list after workspace changes invalidate the cache", async () => {
    mocks.listDir
      .mockResolvedValueOnce([{ name: "old.md", path: "D:\\notes\\old.md", is_dir: false }])
      .mockResolvedValueOnce([{ name: "new.md", path: "D:\\notes\\new.md", is_dir: false }]);

    expect(await listWorkspaceFiles(["D:\\notes"], [])).toEqual(["D:\\notes\\old.md"]);
    invalidateWorkspaceFileCache();
    expect(await listWorkspaceFiles(["D:\\notes"], [])).toEqual(["D:\\notes\\new.md"]);
  });

  it("delegates regular expressions to the native safe matcher", async () => {
    mocks.listDir.mockResolvedValue([
      { name: "emoji.md", path: "D:\\notes\\emoji.md", is_dir: false },
    ]);
    mocks.readFile.mockResolvedValue("a😀b");
    mocks.searchRegex.mockResolvedValue([{
      line: 1,
      lineText: "a😀b",
      matchStart: 1,
      matchEnd: 3,
    }]);

    const result = await searchWorkspace(["D:\\notes"], [], "😀", { useRegex: true });

    expect(mocks.searchRegex).toHaveBeenCalledWith("emoji.md", "a😀b", "😀", false);
    expect(result.matches[0]).toMatchObject({
      path: "D:\\notes\\emoji.md",
      matchStart: 1,
      matchEnd: 3,
    });
  });
});
