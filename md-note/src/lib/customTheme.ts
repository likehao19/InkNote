import { convertFileSrc } from "@tauri-apps/api/core";

const KEY = "mdnote.customCss";
const LINK_ID = "mdnote-custom-css";

export function getCustomCssPath(): string | null {
  return localStorage.getItem(KEY);
}

export function setCustomCssPath(path: string | null) {
  if (path) localStorage.setItem(KEY, path);
  else localStorage.removeItem(KEY);
  applyCustomCss();
}

export function applyCustomCss() {
  const path = getCustomCssPath();
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!path) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.id = LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  try {
    link.href = convertFileSrc(path);
  } catch {
    link.href = path;
  }
}
