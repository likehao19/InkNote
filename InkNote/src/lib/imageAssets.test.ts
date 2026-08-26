import { describe, expect, it } from "vitest";
import { IMAGE_ASSET_DIR, isManagedImageAssetDir } from "./imageAssets";

describe("image asset directory", () => {
  it("uses an InkNote-specific hidden directory", () => {
    expect(IMAGE_ASSET_DIR).toBe(".inknote-assets");
  });

  it("only hides the InkNote-managed directory", () => {
    expect(isManagedImageAssetDir(".inknote-assets")).toBe(true);
    expect(isManagedImageAssetDir("assets")).toBe(false);
    expect(isManagedImageAssetDir("project-assets")).toBe(false);
  });
});
