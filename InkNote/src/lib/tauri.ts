import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getLocale, t, type MessageKey } from "./i18n";
export { isMac, isWin } from "./platform";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

const MD_FILTER = { name: "Markdown", extensions: ["md", "markdown", "txt"] };
const HTML_FILTER = { name: "HTML", extensions: ["html"] };
const PDF_FILTER = { name: "PDF", extensions: ["pdf"] };

const BACKEND_ERROR_KEYS: Record<string, MessageKey> = {
  invalid_source_file: "error.invalidSourceFile",
  directory_exists: "error.directoryExists",
  parent_directory_missing: "error.parentDirectoryMissing",
  file_exists: "error.fileExists",
  pdf_export_unsupported: "error.pdfExportUnsupported",
};

function invokeLocalized<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args).catch((error) => {
    const key = BACKEND_ERROR_KEYS[String(error)];
    if (key) throw new Error(t(getLocale(), key));
    throw error;
  });
}

export function readFile(path: string): Promise<string> {
  return invoke("read_file", { path });
}
/**
 * 记录自己刚写出去的内容。
 *
 * 文件监听事件可能在写入完成前到达。按路径和内容记录进行中的写入，
 * 同时由调用方用 diskContent 识别已经完成但事件迟到的应用写入。
 */
const pendingSelfWrites = new Map<string, Map<string, number>>();

function trackSelfWrite(path: string, content: string, delta: 1 | -1) {
  const contents = pendingSelfWrites.get(path) ?? new Map<string, number>();
  const next = (contents.get(content) ?? 0) + delta;
  if (next > 0) contents.set(content, next);
  else contents.delete(content);
  if (contents.size) pendingSelfWrites.set(path, contents);
  else pendingSelfWrites.delete(path);
}

export function isSelfWritePending(path: string, diskContent: string): boolean {
  return (pendingSelfWrites.get(path)?.get(diskContent) ?? 0) > 0;
}

export function writeFile(path: string, content: string): Promise<void> {
  trackSelfWrite(path, content, 1);
  return invoke<void>("write_file", { path, content }).finally(() => {
    trackSelfWrite(path, content, -1);
  });
}
export function writeBinary(path: string, data: number[]): Promise<void> {
  return invoke("write_binary", { path, data });
}

export async function openImageDialog(): Promise<string | null> {
  const r = await openDialog({
    multiple: false,
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
  });
  return typeof r === "string" ? r : null;
}
export function listDir(path: string): Promise<DirEntry[]> {
  return invoke("list_dir", { path });
}
let startupFileOnce: Promise<string | null> | null = null;

/**
 * 启动文件在 Rust 侧是 `take()` 语义，只能取一次。
 * 这里缓存 Promise，避免 StrictMode 双次挂载时第二次拿到 null。
 */
export function getStartupFile(): Promise<string | null> {
  if (!startupFileOnce) startupFileOnce = invoke<string | null>("get_startup_file");
  return startupFileOnce;
}
export function watchFile(path: string): Promise<void> {
  return invoke("watch_file", { path });
}
export function unwatchFile(): Promise<void> {
  return invoke("unwatch_file");
}
export function watchDirs(paths: string[]): Promise<void> {
  return invoke("watch_dirs", { paths });
}
export function unwatchDir(): Promise<void> {
  return invoke("unwatch_dir");
}
export function copyFileToDir(src: string, destDir: string): Promise<string> {
  return invokeLocalized("copy_file_to_dir", { src, destDir });
}
export function copyFileToDirStrict(src: string, destDir: string): Promise<string> {
  return invokeLocalized("copy_file_to_dir_strict", { src, destDir });
}
export function copyFileToDirOverwrite(src: string, destDir: string): Promise<string> {
  return invokeLocalized("copy_file_to_dir_overwrite", { src, destDir });
}
export function moveFileToDir(src: string, destDir: string): Promise<string> {
  return invokeLocalized("move_file_to_dir", { src, destDir });
}
export function createDir(path: string): Promise<void> {
  return invokeLocalized("create_dir", { path });
}
export function createFile(path: string, content = ""): Promise<void> {
  return invokeLocalized("create_file", { path, content });
}
export function renamePath(oldPath: string, newPath: string): Promise<void> {
  return invokeLocalized("rename_path", { oldPath, newPath });
}
export function removePath(path: string): Promise<void> {
  return invoke("remove_path", { path });
}

export async function openFileDialog(): Promise<string | null> {
  const r = await openDialog({ multiple: false, filters: [MD_FILTER] });
  return typeof r === "string" ? r : null;
}
export async function openFolderDialog(): Promise<string[]> {
  const result = await openDialog({ directory: true, multiple: true });
  if (Array.isArray(result)) return result;
  return typeof result === "string" ? [result] : [];
}
export async function saveFileDialog(defaultPath?: string): Promise<string | null> {
  const r = await saveDialog({ filters: [MD_FILTER], defaultPath });
  return typeof r === "string" ? r : null;
}
export async function saveHtmlDialog(): Promise<string | null> {
  const r = await saveDialog({ filters: [HTML_FILTER] });
  return typeof r === "string" ? r : null;
}
export async function savePdfDialog(defaultPath?: string): Promise<string | null> {
  const r = await saveDialog({ filters: [PDF_FILTER], defaultPath });
  return typeof r === "string" ? r : null;
}
export function exportPdf(path: string, html: string): Promise<void> {
  return invokeLocalized("export_pdf", { path, html });
}
export async function openCssDialog(): Promise<string | null> {
  const r = await openDialog({
    multiple: false,
    filters: [{ name: "CSS", extensions: ["css"] }],
  });
  return typeof r === "string" ? r : null;
}

export function onOpenFile(cb: (path: string) => void): Promise<UnlistenFn> {
  return listen<string>("open-file", (e) => cb(e.payload));
}

export function onFileChanged(cb: (path: string) => void): Promise<UnlistenFn> {
  return listen<string>("file-changed", (e) => cb(e.payload));
}

export function onDirChanged(cb: (path: string) => void): Promise<UnlistenFn> {
  return listen<string>("dir-changed", (e) => cb(e.payload));
}

export type MenuAction =
  | "settings"
  | "open"
  | "save"
  | "save-as"
  | "export-html"
  | "export-pdf"
  | "toggle-sidebar"
  | "focus-mode"
  | "typewriter-mode";

export async function onMenu(cb: (action: MenuAction) => void): Promise<UnlistenFn> {
  const events: [string, MenuAction][] = [
    ["menu-settings", "settings"],
    ["menu-open", "open"],
    ["menu-save", "save"],
    ["menu-save-as", "save-as"],
    ["menu-export-html", "export-html"],
    ["menu-export-pdf", "export-pdf"],
    ["menu-toggle-sidebar", "toggle-sidebar"],
    ["menu-focus-mode", "focus-mode"],
    ["menu-typewriter-mode", "typewriter-mode"],
  ];
  const unsubs = await Promise.all(
    events.map(([ev, action]) => listen(ev, () => cb(action))),
  );
  return () => unsubs.forEach((u) => u());
}
