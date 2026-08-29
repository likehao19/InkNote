import { describe, expect, it } from "vitest";
import { isValidEntryName } from "./paths";

describe("entry name validation", () => {
  it("accepts portable file and folder names", () => {
    expect(isValidEntryName("会议记录 2026.md")).toBe(true);
    expect(isValidEntryName("notes.folder")).toBe(true);
  });

  it.each([
    "../outside.md",
    "folder/note.md",
    "folder\\note.md",
    ".",
    "..",
    "CON.txt",
    "LPT1",
    "trailing.",
    "trailing ",
  ])("rejects unsafe or non-portable name %s", (name) => {
    expect(isValidEntryName(name)).toBe(false);
  });
});
