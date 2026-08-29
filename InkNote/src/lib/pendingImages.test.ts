import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writeBinary: vi.fn(),
  removePath: vi.fn(),
}));

vi.mock("./tauri", () => mocks);

import {
  addPendingImage,
  clearPendingImages,
  commitPendingImages,
  pendingImageUrl,
  preparePendingImages,
  rollbackPendingImages,
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
    mocks.writeBinary.mockReset();
    mocks.removePath.mockReset();
    mocks.writeBinary.mockResolvedValue(undefined);
    mocks.removePath.mockResolvedValue(undefined);
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

  it("writes only images still referenced by the document", async () => {
    vi.mocked(URL.createObjectURL)
      .mockReset()
      .mockReturnValueOnce("blob:kept")
      .mockReturnValueOnce("blob:removed");
    addPendingImage(".inknote-assets/kept.png", new Uint8Array([1]), "image/png");
    addPendingImage(".inknote-assets/removed.png", new Uint8Array([2]), "image/png");

    const prepared = await preparePendingImages(
      "D:\\notes\\note.md",
      "![](.inknote-assets/kept.png)",
    );

    expect(mocks.writeBinary).toHaveBeenCalledTimes(1);
    expect(mocks.writeBinary).toHaveBeenCalledWith(
      "D:/notes/.inknote-assets/kept.png",
      [1],
    );
    expect(pendingImageUrl(".inknote-assets/removed.png")).toBeNull();
    commitPendingImages(prepared);
    expect(pendingImageUrl(".inknote-assets/kept.png")).toBeNull();
  });

  it("rolls back created files while retaining the in-memory image for retry", async () => {
    vi.mocked(URL.createObjectURL).mockReset().mockReturnValue("blob:retry");
    addPendingImage(".inknote-assets/retry.png", new Uint8Array([3]), "image/png");
    const prepared = await preparePendingImages(
      "D:\\notes\\note.md",
      "![](.inknote-assets/retry.png)",
    );

    await rollbackPendingImages(prepared);

    expect(mocks.removePath).toHaveBeenCalledWith("D:/notes/.inknote-assets/retry.png");
    expect(pendingImageUrl(".inknote-assets/retry.png")).toBe("blob:retry");
  });
});
