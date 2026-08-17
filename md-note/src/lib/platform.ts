import { platform } from "@tauri-apps/plugin-os";

export const isMac = platform() === "macos";
export const isWin = platform() === "windows";

/** 在 <html> 上挂载平台 class，供 CSS 做原生差异化样式 */
export function initPlatform() {
  const root = document.documentElement;
  root.classList.remove("platform-mac", "platform-win", "platform-linux");
  if (isMac) root.classList.add("platform-mac");
  else if (isWin) root.classList.add("platform-win");
  else root.classList.add("platform-linux");
}
