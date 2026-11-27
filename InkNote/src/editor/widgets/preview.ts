import { EditorView, WidgetType } from "@codemirror/view";
import { bindBlockBoundaryCursor, bindBlockClickEdit, stampBlockRange } from "./blockRange";
import { safeHtmlFragment } from "../htmlPreview";
import { openPreviewLink } from "../previewLinks";
import {
  attachSourceEditing,
  beginSourceEditing,
  clickedOnBlockPadding,
  makePlainTextEditable,
} from "./editableSource";

export class InlinePreviewWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly text: string,
    readonly className: string,
    readonly tag: "span" | "sup" = "span",
  ) {
    super();
  }

  eq(other: InlinePreviewWidget) {
    return other.to - other.from === this.to - this.from &&
      other.text === this.text && other.className === this.className && other.tag === this.tag;
  }

  toDOM() {
    const el = document.createElement(this.tag);
    el.className = this.className;
    el.textContent = this.text;
    bindBlockClickEdit(el, this.from, this.to);
    return el;
  }

  ignoreEvent() {
    return true;
  }
}

export class EditableMetadataWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly sourceText: string,
    readonly previewText: string,
    readonly kind: "reference" | "footnote",
  ) {
    super();
  }

  eq(other: EditableMetadataWidget) {
    return other.to - other.from === this.to - this.from &&
      other.sourceText === this.sourceText && other.previewText === this.previewText &&
      other.kind === this.kind;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = `md-metadata-widget md-metadata-${this.kind}`;
    stampBlockRange(wrap, this.from, this.to);

    const source = document.createElement("div");
    source.className = "md-block-source";
    makePlainTextEditable(source);
    source.textContent = this.sourceText;

    const preview = document.createElement("div");
    preview.className = "md-metadata-preview";
    preview.textContent = this.previewText;

    wrap.append(source, preview);
    bindBlockBoundaryCursor(wrap, preview);
    attachSourceEditing(wrap, {
      source: () => source,
      toMarkdown: (text) => text.replace(/\n+$/, ""),
      indentOnTab: false,
    });
    preview.addEventListener("mousedown", (event) => {
      event.preventDefault();
      beginSourceEditing(wrap, source, false);
    });
    return wrap;
  }

  updateDOM(dom: HTMLElement) {
    const source = dom.querySelector<HTMLElement>(".md-block-source");
    const preview = dom.querySelector<HTMLElement>(".md-metadata-preview");
    if (!source || !preview) return false;
    stampBlockRange(dom, this.from, this.to);
    if (document.activeElement !== source) source.textContent = this.sourceText;
    preview.textContent = this.previewText;
    return true;
  }

  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-metadata-widget");
  }
}


function renderHtmlBlock(preview: HTMLElement, source: HTMLElement, html: string, filePath: string | null) {
  preview.replaceChildren(safeHtmlFragment(html, filePath));
  if (!/<details(?=[\s>])/i.test(html) || !/\n[\t ]*\n/.test(html)) return;

  // Markdown between blank lines in a details element is rendered as it is in export.
  const firstChild = preview.firstChild;
  void import("../../render/export").then(({ markdownToBodyHtml }) => markdownToBodyHtml(html)).then((rendered) => {
    if (!preview.isConnected || preview.firstChild !== firstChild || source.textContent !== html) return;
    const open = Array.from(preview.querySelectorAll("details"), (details) => details.open);
    const fragment = safeHtmlFragment(rendered, filePath);
    fragment.querySelectorAll("details").forEach((details, index) => {
      if (open[index] !== undefined) details.open = open[index];
    });
    preview.replaceChildren(fragment);
    EditorView.findFromDOM(preview)?.requestMeasure();
  }).catch(() => { /* Keep the HTML preview if Markdown rendering fails. */ });
}

export class HtmlBlockWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly html: string,
    readonly filePath: string | null,
  ) {
    super();
  }

  eq(other: HtmlBlockWidget) {
    return other.to - other.from === this.to - this.from && other.html === this.html && other.filePath === this.filePath;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-html-widget";
    stampBlockRange(wrap, this.from, this.to);

    const source = document.createElement("div");
    source.className = "md-block-source";
    makePlainTextEditable(source);
    source.textContent = this.html;

    const preview = document.createElement("div");
    preview.className = "md-html-preview";
    renderHtmlBlock(preview, source, this.html, this.filePath);
    wrap.append(source, preview);
    bindBlockBoundaryCursor(wrap, preview);

    attachSourceEditing(wrap, {
      source: () => source,
      toMarkdown: (text) => text.replace(/\n+$/, ""),
      onInput: (text) => renderHtmlBlock(preview, source, text, this.filePath),
      indentOnTab: true,
    });
    preview.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest<HTMLElement>("[data-html-href]");
      const view = EditorView.findFromDOM(wrap);
      if (event.button !== 0) return;
      if (link?.dataset.htmlHref && view && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        openPreviewLink(view, link.dataset.htmlHref, this.filePath);
        return;
      }
      if (!view || view.state.readOnly || target.closest("summary")) return;
      event.preventDefault();
      beginSourceEditing(wrap, source, false);
    });
    preview.addEventListener("keydown", (event) => {
      const link = (event.target as HTMLElement).closest<HTMLElement>("[data-html-href]");
      const view = EditorView.findFromDOM(wrap);
      if (event.key === "Enter" && link?.dataset.htmlHref && view) {
        event.preventDefault();
        openPreviewLink(view, link.dataset.htmlHref, this.filePath);
      }
    });
    const measure = () => EditorView.findFromDOM(wrap)?.requestMeasure();
    preview.addEventListener("toggle", measure, true);
    preview.addEventListener("load", measure, true);
    return wrap;
  }

  updateDOM(dom: HTMLElement, _view: EditorView, previous: HtmlBlockWidget) {
    if (this.filePath !== previous.filePath) return false;
    const source = dom.querySelector<HTMLElement>(".md-block-source");
    const preview = dom.querySelector<HTMLElement>(".md-html-preview");
    if (!source || !preview) return false;
    stampBlockRange(dom, this.from, this.to);
    if (document.activeElement !== source) {
      source.textContent = this.html;
      renderHtmlBlock(preview, source, this.html, this.filePath);
    }
    EditorView.findFromDOM(dom)?.requestMeasure();
    return true;
  }

  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-html-widget");
  }
}
