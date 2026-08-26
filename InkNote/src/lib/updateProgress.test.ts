import { describe, expect, it } from "vitest";
import { nextUpdatePercent } from "./updateProgress";

describe("nextUpdatePercent", () => {
  it("never moves a displayed update backwards", () => {
    expect(nextUpdatePercent(70, 100, 80)).toBe(80);
  });

  it("clamps completed downloads to 100 percent", () => {
    expect(nextUpdatePercent(120, 100, 90)).toBe(100);
  });

  it("keeps the previous value when the total size is unavailable", () => {
    expect(nextUpdatePercent(20, 0, 10)).toBe(10);
  });
});
