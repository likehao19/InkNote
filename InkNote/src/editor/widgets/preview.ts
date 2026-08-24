import { EditorView, WidgetType } from "@codemirror/view";
import { bindBlockBoundaryCursor, bindBlockClickEdit, stampBlockRange } from "./blockRange";
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

function renderSafeHtml(target: HTMLElement, html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,link,meta,base").forEach((el) => el.remove());
  parsed.querySelectorAll<HTMLElement>("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().replace(/[\u0000-\u0020]+/g, "");
      if (name.startsWith("on") || name === "style") el.removeAttribute(attr.name);
      if (
        ["href", "src", "xlink:href", "action", "formaction"].includes(name) &&
        (/^(?:javascript|vbscript):/i.test(value) ||
          (/^data:/i.test(value) && !(name === "src" && /^data:image\/(?:png|gif|jpe?g|webp);/i.test(value))))
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  target.replaceChildren(...Array.from(parsed.body.childNodes));
}

export class HtmlBlockWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly html: string,
  ) {
    super();
  }

  eq(other: HtmlBlockWidget) {
    return other.to - other.from === this.to - this.from && other.html === this.html;
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
    renderSafeHtml(preview, this.html);
    wrap.append(source, preview);
    bindBlockBoundaryCursor(wrap, preview);

    attachSourceEditing(wrap, {
      source: () => source,
      toMarkdown: (text) => text.replace(/\n+$/, ""),
      onInput: (text) => renderSafeHtml(preview, text),
      indentOnTab: true,
    });
    preview.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("a,button,input,select,textarea")) return;
      event.preventDefault();
      beginSourceEditing(wrap, source, false);
    });
    return wrap;
  }

  updateDOM(dom: HTMLElement) {
    const source = dom.querySelector<HTMLElement>(".md-block-source");
    const preview = dom.querySelector<HTMLElement>(".md-html-preview");
    if (!source || !preview) return false;
    stampBlockRange(dom, this.from, this.to);
    if (document.activeElement !== source) {
      source.textContent = this.html;
      renderSafeHtml(preview, this.html);
    }
    EditorView.findFromDOM(dom)?.requestMeasure();
    return true;
  }

  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-html-widget");
  }
}
