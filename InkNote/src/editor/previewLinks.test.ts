import { describe, expect, it } from "vitest";
import { resolveDocumentLink } from "./previewLinks";

describe("relative document links", () => {
  it.each([
    ["/notes/a.md", "../other/New%20file.md", "/other/New file.md"],
    ["D:\\notes\\a.md", "../other/b.md", "D:\\other\\b.md"],
    ["\\\\server\\share\\notes\\a.md", "../b.md", "\\\\server\\share\\b.md"],
    ["/notes/a.md", "hash%23name.markdown", "/notes/hash#name.markdown"],
  ])("resolves %s and %s", (source, target, expected) => {
    expect(resolveDocumentLink(source, target)).toBe(expected);
  });

  it.each(["//server/share/a.md", "file:///a.md", "script.exe", "%2Fetc%2Fa.md", "bad%ZZ.md", "a.md:stream.txt"])(
    "rejects an unsupported target %s", (target) => {
      expect(resolveDocumentLink("/notes/a.md", target)).toBeNull();
    },
  );
});
