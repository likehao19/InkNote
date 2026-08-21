import { convertFileSrc } from "@tauri-apps/api/core";
import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.customCss";
const LINK_ID = "mdnote-custom-css";

export function getCustomCssPath(): string | null {
  return getStoredValue(KEY);
}

export function setCustomCssPath(path: string | null) {
  if (path) setStoredValue(KEY, path);
  else removeStoredValue(KEY);
  window.dispatchEvent(new Event("mdnote-custom-css-changed"));
}

/** 将自定义 CSS 注入编辑器容器，仅影响预览区域 */
export function applyCustomCssToHost(host: HTMLElement | null) {
  const existing = host?.querySelector(`#${LINK_ID}`) as HTMLLinkElement | null;
  if (existing) existing.remove();

  const path = getCustomCssPath();
  if (!host || !path) return;

  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  try {
    link.href = convertFileSrc(path);
  } catch {
    link.href = path;
  }
  host.appendChild(link);
}

export function removeCustomCssFromHost(host: HTMLElement | null) {
  const link = host?.querySelector(`#${LINK_ID}`);
  link?.remove();
}
