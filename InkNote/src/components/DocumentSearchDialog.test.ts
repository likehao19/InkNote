import { describe, expect, it } from "vitest";
import { collectDocumentMatches } from "./DocumentSearchDialog";

describe("current document search", () => {
  it("returns every match with its document line number", () => {
    const matches = collectDocumentMatches("Alpha beta\nalpha Alpha", "alpha", false, false);
    expect(matches.map(({ line, lineStart }) => [line, lineStart])).toEqual([
      [1, 0],
      [2, 0],
      [2, 6],
    ]);
  });

  it("supports case-sensitive and regular-expression searches", () => {
    expect(collectDocumentMatches("Alpha alpha", "Alpha", true, false)).toHaveLength(1);
    expect(collectDocumentMatches("item-12 item-x", "item-\\d+", false, true)).toHaveLength(1);
    expect(collectDocumentMatches("text", "[", false, true)).toEqual([]);
  });
});
