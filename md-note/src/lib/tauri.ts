import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
export { isMac, isWin } from "./platform";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

const MD_FILTER = { name: "Markdown", extensions: ["md", "markdown", "txt"] };
const HTML_FILTER = { name: "HTML", extensions: ["html"] };

export function readFile(path: string): Promise<string> {
  return invoke("read_file", { path });
}
export function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}
export function writeBinary(path: string, data: number[]): Promise<void> {
  return invoke("write_binary", { path, data });
}
export function listDir(path: string): Promise<DirEntry[]> {
  return invoke("list_dir", { path });
}
export function getStartupFile(): Promise<string | null> {
  return invoke("get_startup_file");
}
export function watchFile(path: string): Promise<void> {
  return invoke("watch_file", { path });
}
export function unwatchFile(): Promise<void> {
  return invoke("unwatch_file");
}
export function watchDir(path: string): Promise<void> {
  return invoke("watch_dir", { path });
}
export function unwatchDir(): Promise<void> {
  return invoke("unwatch_dir");
}
export function copyFileToDir(src: string, destDir: string): Promise<string> {
  return invoke("copy_file_to_dir", { src, destDir });
}
export function createDir(path: string): Promise<void> {
  return invoke("create_dir", { path });
}
export function createFile(path: string, content = ""): Promise<void> {
  return invoke("create_file", { path, content });
}
export function renamePath(oldPath: string, newPath: string): Promise<void> {
  return invoke("rename_path", { oldPath, newPath });
}
export function removePath(path: string): Promise<void> {
  return invoke("remove_path", { path });
}

export async function openFileDialog(): Promise<string | null> {
  const r = await openDialog({ multiple: false, filters: [MD_FILTER] });
  return typeof r === "string" ? r : null;
}
export async function openFolderDialog(): Promise<string | null> {
  const r = await openDialog({ directory: true, multiple: false });
  return typeof r === "string" ? r : null;
}
export async function saveFileDialog(defaultPath?: string): Promise<string | null> {
  const r = await saveDialog({ filters: [MD_FILTER], defaultPath });
  return typeof r === "string" ? r : null;
}
export async function saveHtmlDialog(): Promise<string | null> {
  const r = await saveDialog({ filters: [HTML_FILTER] });
  return typeof r === "string" ? r : null;
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
