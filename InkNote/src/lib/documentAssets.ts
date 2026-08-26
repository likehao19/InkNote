import * as api from "./tauri";
import {
  extractManagedImageReferences,
  IMAGE_ASSET_DIR,
  rewriteManagedImageReferences,
} from "./imageAssets";
import { basename, dirOf, joinPath } from "./paths";

export type FileConflictAction = "overwrite" | "rename";
export type DocumentTransferMode = "copy" | "move";

function samePath(left: string, right: string): boolean {
  return left.replace(/\\/g, "/").toLowerCase() === right.replace(/\\/g, "/").toLowerCase();
}

function encodedMarkdownFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

async function listDirOrEmpty(path: string): Promise<api.DirEntry[]> {
  try {
    return await api.listDir(path);
  } catch {
    return [];
  }
}

async function ensureAssetDirectory(path: string): Promise<boolean> {
  try {
    await api.listDir(path);
    return false;
  } catch {
    await api.createDir(path);
    return true;
  }
}

export type ManagedImageCopy = {
  content: string;
  replacements: ReadonlyMap<string, string>;
  rollback: () => Promise<void>;
};

async function copyManagedImages(
  sourceDocumentPath: string,
  destinationDirectory: string,
  content: string,
): Promise<ManagedImageCopy> {
  const references = extractManagedImageReferences(content);
  const sourceAssetDirectory = joinPath(dirOf(sourceDocumentPath), IMAGE_ASSET_DIR);
  const destinationAssetDirectory = joinPath(destinationDirectory, IMAGE_ASSET_DIR);
  if (!references.length || samePath(sourceAssetDirectory, destinationAssetDirectory)) {
    return { content, replacements: new Map(), rollback: async () => undefined };
  }

  const sourceAssets = await listDirOrEmpty(sourceAssetDirectory);
  if (!sourceAssets.length) return { content, replacements: new Map(), rollback: async () => undefined };

  let createdDirectory = false;
  const copiedPaths: string[] = [];
  const replacements = new Map<string, string>();
  try {
    createdDirectory = await ensureAssetDirectory(destinationAssetDirectory);
    const copiedByFileName = new Map<string, string>();
    for (const reference of references) {
      const key = reference.fileName.toLowerCase();
      let copiedName = copiedByFileName.get(key);
      if (!copiedName) {
        const asset = sourceAssets.find((entry) => !entry.is_dir && entry.name.toLowerCase() === key);
        if (!asset) continue;
        const copiedPath = await api.copyFileToDir(asset.path, destinationAssetDirectory);
        copiedPaths.push(copiedPath);
        copiedName = basename(copiedPath);
        copiedByFileName.set(key, copiedName);
      }
      replacements.set(reference.source, `${IMAGE_ASSET_DIR}/${encodedMarkdownFileName(copiedName)}`);
    }
  } catch (error) {
    for (const path of copiedPaths.reverse()) {
      try { await api.removePath(path); } catch { /* keep the original transfer error */ }
    }
    if (createdDirectory) {
      try {
        if ((await listDirOrEmpty(destinationAssetDirectory)).length === 0) {
          await api.removePath(destinationAssetDirectory);
        }
      } catch { /* keep the original transfer error */ }
    }
    throw error;
  }

  return {
    content: rewriteManagedImageReferences(content, replacements),
    replacements,
    rollback: async () => {
      for (const path of copiedPaths.reverse()) {
        try { await api.removePath(path); } catch { /* best-effort rollback */ }
      }
      if (createdDirectory) {
        try {
          if ((await listDirOrEmpty(destinationAssetDirectory)).length === 0) {
            await api.removePath(destinationAssetDirectory);
          }
        } catch { /* best-effort rollback */ }
      }
    },
  };
}

export async function prepareManagedImagesForSaveAs(
  sourceDocumentPath: string | null,
  destinationPath: string,
  content: string,
): Promise<ManagedImageCopy> {
  if (!sourceDocumentPath) {
    return { content, replacements: new Map(), rollback: async () => undefined };
  }
  return copyManagedImages(sourceDocumentPath, dirOf(destinationPath), content);
}

async function referencedBySiblingDocument(
  documentPath: string,
  fileName: string,
): Promise<boolean> {
  const directory = dirOf(documentPath);
  const entries = await listDirOrEmpty(directory);
  for (const entry of entries) {
    if (entry.is_dir || samePath(entry.path, documentPath) || !/\.(md|markdown|txt)$/i.test(entry.name)) continue;
    try {
      const content = await api.readFile(entry.path);
      if (extractManagedImageReferences(content).some((reference) => (
        reference.fileName.toLowerCase() === fileName.toLowerCase()
      ))) return true;
    } catch {
      // A temporarily unreadable sibling must not make document saving fail.
      return true;
    }
  }
  return false;
}

export async function cleanupRemovedManagedImages(
  documentPath: string,
  previousContent: string,
  currentContent: string,
): Promise<void> {
  const currentNames = new Set(
    extractManagedImageReferences(currentContent).map((reference) => reference.fileName.toLowerCase()),
  );
  const removedNames = new Set(
    extractManagedImageReferences(previousContent)
      .map((reference) => reference.fileName)
      .filter((fileName) => !currentNames.has(fileName.toLowerCase())),
  );
  if (!removedNames.size) return;

  const assetDirectory = joinPath(dirOf(documentPath), IMAGE_ASSET_DIR);
  const assets = await listDirOrEmpty(assetDirectory);
  for (const fileName of removedNames) {
    if (await referencedBySiblingDocument(documentPath, fileName)) continue;
    const asset = assets.find((entry) => !entry.is_dir && entry.name.toLowerCase() === fileName.toLowerCase());
    if (asset) await api.removePath(asset.path);
  }

  const remaining = await listDirOrEmpty(assetDirectory);
  if (assets.length > 0 && remaining.length === 0) await api.removePath(assetDirectory);
}

export async function removeDocumentWithManagedImages(documentPath: string): Promise<void> {
  let content = "";
  try {
    content = await api.readFile(documentPath);
  } catch {
    // Keep regular deletion available even when the document cannot be decoded.
  }
  await api.removePath(documentPath);
  if (content) {
    try {
      await cleanupRemovedManagedImages(documentPath, content, "");
    } catch {
      // The document is already deleted. Orphan cleanup must not report the whole deletion as failed.
    }
  }
}

export async function transferDocumentWithManagedImages(
  sourcePath: string,
  destinationDirectory: string,
  mode: DocumentTransferMode,
  conflictAction?: FileConflictAction,
): Promise<string> {
  if (mode === "move" && samePath(dirOf(sourcePath), destinationDirectory)) return sourcePath;
  if (
    mode === "copy" &&
    conflictAction === "overwrite" &&
    samePath(dirOf(sourcePath), destinationDirectory)
  ) return sourcePath;

  const sourceContent = await api.readFile(sourcePath);
  let overwrittenContent = "";
  let destinationExisted = false;
  const expectedDestinationPath = joinPath(destinationDirectory, basename(sourcePath));
  if (conflictAction === "overwrite") {
    try {
      overwrittenContent = await api.readFile(expectedDestinationPath);
      destinationExisted = true;
    } catch {
      // The destination may disappear between conflict selection and the copy.
    }
  }
  let destinationPath: string | null = null;
  let managedCopy: ManagedImageCopy | null = null;
  try {
    destinationPath = conflictAction === "overwrite"
      ? await api.copyFileToDirOverwrite(sourcePath, destinationDirectory)
      : conflictAction === "rename"
        ? await api.copyFileToDir(sourcePath, destinationDirectory)
        : await api.copyFileToDirStrict(sourcePath, destinationDirectory);

    managedCopy = await copyManagedImages(sourcePath, destinationDirectory, sourceContent);
    await api.writeFile(destinationPath, managedCopy.content);

    if (mode === "move" && !samePath(sourcePath, destinationPath)) {
      await api.removePath(sourcePath);
    }
  } catch (error) {
    await managedCopy?.rollback();
    if (destinationPath && !samePath(destinationPath, sourcePath)) {
      try {
        if (destinationExisted) await api.writeFile(destinationPath, overwrittenContent);
        else await api.removePath(destinationPath);
      } catch { /* keep the original transfer error */ }
    }
    throw error;
  }

  if (destinationExisted) {
    try { await cleanupRemovedManagedImages(destinationPath, overwrittenContent, managedCopy.content); } catch { /* best effort */ }
  }
  if (mode === "move" && !samePath(sourcePath, destinationPath)) {
    try { await cleanupRemovedManagedImages(sourcePath, sourceContent, ""); } catch { /* best effort */ }
  }
  return destinationPath;
}
