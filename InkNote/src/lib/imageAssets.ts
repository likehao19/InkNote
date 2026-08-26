export const IMAGE_ASSET_DIR = ".inknote-assets";

export function isManagedImageAssetDir(name: string): boolean {
  return name.toLowerCase() === IMAGE_ASSET_DIR;
}
