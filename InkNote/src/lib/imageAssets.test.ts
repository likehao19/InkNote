import { describe, expect, it } from "vitest";
import {
  extractManagedImageReferences,
  IMAGE_ASSET_DIR,
  isManagedImageAssetDir,
  rewriteManagedImageReferences,
} from "./imageAssets";

describe("image asset directory", () => {
  it("uses an InkNote-specific hidden directory", () => {
    expect(IMAGE_ASSET_DIR).toBe(".inknote-assets");
  });

  it("only hides the InkNote-managed directory", () => {
    expect(isManagedImageAssetDir(".inknote-assets")).toBe(true);
    expect(isManagedImageAssetDir("assets")).toBe(false);
    expect(isManagedImageAssetDir("project-assets")).toBe(false);
  });

  it("extracts only safely managed Markdown and HTML image references", () => {
    const markdown = [
      "![first](.inknote-assets/one.png)",
      "![second](<./.inknote-assets/two%20words.jpg> \"title\")",
      '<img src=".inknote-assets/three.webp">',
      "![external](assets/external.png)",
      "![unsafe](.inknote-assets/../secret.png)",
      "![remote](https://example.com/image.png)",
    ].join("\n");

    expect(extractManagedImageReferences(markdown)).toEqual([
      { source: ".inknote-assets/one.png", fileName: "one.png" },
      { source: "./.inknote-assets/two%20words.jpg", fileName: "two words.jpg" },
      { source: ".inknote-assets/three.webp", fileName: "three.webp" },
    ]);
  });

  it("rewrites copied managed image paths without touching other images", () => {
    const markdown = "![a](.inknote-assets/a.png) ![b](assets/b.png)";
    expect(rewriteManagedImageReferences(
      markdown,
      new Map([[".inknote-assets/a.png", ".inknote-assets/a (1).png"]]),
    )).toBe("![a](.inknote-assets/a (1).png) ![b](assets/b.png)");
  });

  it("extracts full, collapsed, and shortcut reference-style images", () => {
    const markdown = [
      "![full][cover]",
      "![collapsed][]",
      "![shortcut]",
      "[cover]: .inknote-assets/cover.png \"Cover\"",
      "[collapsed]: <./.inknote-assets/collapsed%20image.webp>",
      "[shortcut]: .inknote-assets/shortcut.jpg",
      "[unused]: .inknote-assets/unused.png",
    ].join("\n");

    expect(extractManagedImageReferences(markdown)).toEqual([
      { source: ".inknote-assets/cover.png", fileName: "cover.png" },
      { source: "./.inknote-assets/collapsed%20image.webp", fileName: "collapsed image.webp" },
      { source: ".inknote-assets/shortcut.jpg", fileName: "shortcut.jpg" },
    ]);
  });
});
