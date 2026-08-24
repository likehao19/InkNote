import { describe, expect, it } from "vitest";
import { messages } from "./i18n";

describe("interface translations", () => {
  it("keeps Chinese and English keys complete and non-empty", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.zh).sort());
    expect(Object.values(messages.zh).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(messages.en).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("uses the localized product name in the title bar", () => {
    expect(messages.zh["title.brand"]).toBe("墨笺");
    expect(messages.en["title.brand"]).toBe("InkNote");
  });
});
