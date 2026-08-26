import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tauri", () => ({ writeBinary: vi.fn() }));

import {
  addPendingImage,
  clearPendingImages,
  pendingImageUrl,
  restorePendingImages,
  snapshotPendingImages,
} from "./pendingImages";

describe("pending images", () => {
  beforeEach(() => {
    clearPendingImages();
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:restored");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearPendingImages();
    vi.restoreAllMocks();
  });

  it("restores an unsaved document image with a fresh blob URL", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    addPendingImage(".inknote-assets/picture.png", bytes, "image/png");

    const snapshot = snapshotPendingImages();
    bytes[0] = 9;
    clearPendingImages();
    restorePendingImages(snapshot);

    expect(snapshot[0].bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(pendingImageUrl(".inknote-assets/picture.png")).toBe("blob:restored");
  });
});
