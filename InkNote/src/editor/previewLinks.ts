import { openUrl } from "@tauri-apps/plugin-opener";
import type { EditorView } from "@codemirror/view";
import { editorShowError } from "../lib/editorBridge";
import { extractMarkdownOutline } from "../lib/markdownOutline";

export function openPreviewLink(view: EditorView, url: string) {
  if (!url.startsWith("#")) {
    void openUrl(url).catch(() => editorShowError(url));
    return;
  }
  let anchor = url.slice(1);
  try { anchor = decodeURIComponent(anchor); } catch { /* Keep malformed fragments literal. */ }
  const heading = extractMarkdownOutline(view.state.doc.toString()).find((item) => item.anchor === anchor);
  if (heading) {
    const line = view.state.doc.line(heading.line);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
  }
}
