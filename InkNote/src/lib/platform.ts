import { platform } from "@tauri-apps/plugin-os";

function currentPlatform(): string {
  try {
    return platform();
  } catch {
    const value = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent;
    if (/mac/i.test(value)) return "macos";
    if (/win/i.test(value)) return "windows";
    return "linux";
  }
}

const detectedPlatform = currentPlatform();
export const isMac = detectedPlatform === "macos";
export const isWin = detectedPlatform === "windows";
export const isLinux = detectedPlatform === "linux";

/** 在 <html> 上挂载平台 class，供 CSS 做原生差异化样式 */
export function initPlatform() {
  const root = document.documentElement;
  root.classList.remove("platform-mac", "platform-win", "platform-linux");
  if (isMac) root.classList.add("platform-mac");
  else if (isWin) root.classList.add("platform-win");
  else root.classList.add("platform-linux");
}
