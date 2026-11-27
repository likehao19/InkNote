import { openUrl } from "@tauri-apps/plugin-opener";
import type { EditorView } from "@codemirror/view";
import { editorOpenDocumentLink, editorShowError } from "../lib/editorBridge";
import { extractMarkdownOutline } from "../lib/markdownOutline";
import { getLocale, t } from "../lib/i18n";

export function resolveDocumentLink(sourcePath: string, target: string): string | null {
  const source = sourcePath.replace(/\\/g, "/");
  const root = /^(?:[a-z]:\/|\/\/[^/]+\/[^/]+\/|\/)/i.exec(source)?.[0];
  if (!root) return null;
  let path: string;
  try { path = decodeURIComponent(target).replace(/\\/g, "/"); } catch { return null; }
  if (!/\.(?:md|markdown|txt)$/i.test(path) || /^[\/]/.test(path) || /[:\u0000-\u001f]/.test(path)) return null;
  const parts = source.slice(root.length).split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const resolved = root + parts.join("/");
  return sourcePath.includes("\\") ? resolved.replace(/\//g, "\\") : resolved;
}

export function findLinkedHeading(content: string, fragment: string): number | undefined {
  if (!fragment) return;
  let anchor = fragment;
  try { anchor = decodeURIComponent(anchor); } catch { /* Keep malformed fragments literal. */ }
  return extractMarkdownOutline(content).find((item) => item.anchor === anchor || item.text === anchor)?.line;
}

export function openPreviewLink(view: EditorView, url: string, sourcePath: string | null) {
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(url)) {
    void openUrl(url).catch(() => editorShowError(t(getLocale(), "error.openPreviewLink", { path: url })));
    return;
  }
  const hash = url.indexOf("#");
  const target = hash < 0 ? url : url.slice(0, hash);
  const fragment = hash < 0 ? "" : url.slice(hash + 1);
  if (target) {
    const path = sourcePath && resolveDocumentLink(sourcePath, target);
    if (path) editorOpenDocumentLink(path, fragment);
    else editorShowError(t(getLocale(), "error.localDocumentLink", { path: url }));
    return;
  }
  const headingLine = findLinkedHeading(view.state.doc.toString(), fragment);
  if (headingLine) {
    const line = view.state.doc.line(headingLine);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
  }
}
