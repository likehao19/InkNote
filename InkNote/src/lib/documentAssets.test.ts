import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./tauri";
import {
  prepareManagedImagesForSaveAs,
  removeDocumentWithManagedImages,
  transferDocumentWithManagedImages,
} from "./documentAssets";

vi.mock("./tauri", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  listDir: vi.fn(),
  createDir: vi.fn(),
  copyFileToDir: vi.fn(),
  copyFileToDirStrict: vi.fn(),
  copyFileToDirOverwrite: vi.fn(),
  removePath: vi.fn(),
}));

const mockedApi = vi.mocked(api);

describe("managed document assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.writeFile.mockResolvedValue(undefined);
    mockedApi.createDir.mockResolvedValue(undefined);
    mockedApi.removePath.mockResolvedValue(undefined);
  });

  it("copies managed images and rewrites renamed asset references", async () => {
    mockedApi.readFile.mockResolvedValue("![image](.inknote-assets/photo.png)");
    mockedApi.copyFileToDirStrict.mockResolvedValue("D:\\target\\note.md");
    mockedApi.listDir.mockImplementation(async (path) => {
      if (path === "D:/source/.inknote-assets") {
        return [{ name: "photo.png", path: "D:\\source\\.inknote-assets\\photo.png", is_dir: false }];
      }
      if (path === "D:\\target\\.inknote-assets") throw new Error("missing");
      return [];
    });
    mockedApi.copyFileToDir.mockResolvedValue("D:\\target\\.inknote-assets\\photo (1).png");

    await expect(transferDocumentWithManagedImages(
      "D:\\source\\note.md",
      "D:\\target",
      "copy",
    )).resolves.toBe("D:\\target\\note.md");

    expect(mockedApi.createDir).toHaveBeenCalledWith("D:/target", ".inknote-assets");
    expect(mockedApi.writeFile).toHaveBeenCalledWith(
      "D:\\target\\note.md",
      "![image](.inknote-assets/photo%20%281%29.png)",
    );
  });

  it("keeps an image that is still referenced by a sibling document", async () => {
    mockedApi.readFile.mockImplementation(async (path) => (
      path.endsWith("deleted.md")
        ? "![image](.inknote-assets/shared.png)"
        : "![shared](.inknote-assets/shared.png)"
    ));
    mockedApi.listDir.mockImplementation(async (path) => {
      if (path.endsWith(".inknote-assets")) {
        return [{ name: "shared.png", path: `${path}\\shared.png`, is_dir: false }];
      }
      return [{ name: "other.md", path: "D:\\notes\\other.md", is_dir: false }];
    });

    await removeDocumentWithManagedImages("D:\\notes\\deleted.md");

    expect(mockedApi.removePath).toHaveBeenCalledWith("D:\\notes\\deleted.md");
    expect(mockedApi.removePath).not.toHaveBeenCalledWith("D:\\notes\\.inknote-assets\\shared.png");
  });

  it("does not report document deletion as failed when orphan cleanup fails", async () => {
    mockedApi.readFile.mockResolvedValue("![image](.inknote-assets/orphan.png)");
    mockedApi.listDir.mockImplementation(async (path) => (
      path.endsWith(".inknote-assets")
        ? [{ name: "orphan.png", path: `${path}\\orphan.png`, is_dir: false }]
        : []
    ));
    mockedApi.removePath
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("asset locked"));

    await expect(removeDocumentWithManagedImages("D:\\notes\\deleted.md")).resolves.toBeUndefined();
    expect(mockedApi.removePath).toHaveBeenNthCalledWith(1, "D:\\notes\\deleted.md");
  });

  it("rolls back the copied document when copying a managed image fails", async () => {
    mockedApi.readFile.mockResolvedValue("![image](.inknote-assets/photo.png)");
    mockedApi.copyFileToDirStrict.mockResolvedValue("D:\\target\\note.md");
    mockedApi.listDir.mockImplementation(async (path) => {
      if (path === "D:/source/.inknote-assets") {
        return [{ name: "photo.png", path: "D:\\source\\.inknote-assets\\photo.png", is_dir: false }];
      }
      if (path === "D:\\target\\.inknote-assets") throw new Error("missing");
      return [];
    });
    mockedApi.copyFileToDir.mockRejectedValue(new Error("disk full"));

    await expect(transferDocumentWithManagedImages(
      "D:\\source\\note.md",
      "D:\\target",
      "copy",
    )).rejects.toThrow("disk full");

    expect(mockedApi.removePath).toHaveBeenCalledWith("D:\\target\\note.md");
    expect(mockedApi.removePath).toHaveBeenCalledWith("D:\\target\\.inknote-assets");
  });

  it("copies and rewrites managed images when saving to another directory", async () => {
    mockedApi.listDir.mockImplementation(async (path) => {
      if (path === "D:/source/.inknote-assets") {
        return [{ name: "photo.png", path: "D:\\source\\.inknote-assets\\photo.png", is_dir: false }];
      }
      if (path === "D:\\target\\.inknote-assets") throw new Error("missing");
      return [];
    });
    mockedApi.copyFileToDir.mockResolvedValue("D:\\target\\.inknote-assets\\photo (1).png");

    const prepared = await prepareManagedImagesForSaveAs(
      "D:\\source\\note.md",
      "D:\\target\\renamed.md",
      "![image](.inknote-assets/photo.png)",
    );

    expect(prepared.content).toBe("![image](.inknote-assets/photo%20%281%29.png)");
  });
});
