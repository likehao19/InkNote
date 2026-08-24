import { dirOf } from "./paths";
import { writeBinary } from "./tauri";

/**
 * 文档还没保存时粘贴进来的图片。
 *
 * 不能因为「还不知道该存哪」就弹保存框打断书写：先把字节留在内存、
 * 用 blob URL 立刻回显，等文档拿到真实路径时再统一落盘到 assets/。
 */
interface PendingImage {
  bytes: Uint8Array;
  url: string;
}

const pending = new Map<string, PendingImage>();

/** 暂存并返回可立即用于 <img> 的 URL；key 是插入到 Markdown 里的相对路径 */
export function addPendingImage(relPath: string, bytes: Uint8Array, mime: string): string {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  pending.set(relPath, { bytes, url });
  return url;
}

export function pendingImageUrl(relPath: string): string | null {
  return pending.get(relPath)?.url ?? null;
}

export function pendingImageCount(): number {
  return pending.size;
}

export function clearPendingImages(): void {
  for (const item of pending.values()) URL.revokeObjectURL(item.url);
  pending.clear();
}

export interface PreparedPendingImage {
  relPath: string;
  url: string;
}

/**
 * 先把图片写到文档目录，但暂不释放内存副本。
 * 只有文档本身也成功写入后，调用方才能 commit；这样另存失败后仍可换目录重试。
 */
export async function preparePendingImages(docPath: string): Promise<PreparedPendingImage[]> {
  if (!pending.size) return [];
  const dir = dirOf(docPath);
  const prepared: PreparedPendingImage[] = [];
  for (const [relPath, item] of [...pending.entries()]) {
    const abs = `${dir}/${relPath}`.replace(/\\/g, "/");
    await writeBinary(abs, Array.from(item.bytes));
    prepared.push({ relPath, url: item.url });
  }
  return prepared;
}

/** 文档写入成功后提交对应图片，避免部分成功造成永久断图。 */
export function commitPendingImages(prepared: PreparedPendingImage[]): void {
  for (const item of prepared) {
    const current = pending.get(item.relPath);
    if (!current || current.url !== item.url) continue;
    URL.revokeObjectURL(current.url);
    pending.delete(item.relPath);
  }
}
