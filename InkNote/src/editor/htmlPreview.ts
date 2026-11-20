import { convertFileSrc } from "@tauri-apps/api/core";
import { WidgetType, EditorView } from "@codemirror/view";
import { resolveAssetPath } from "../lib/paths";
import {
  HTML_BLOCK_TAGS, HTML_IMAGE_SIZE, HTML_INLINE_TAGS, HTML_STRIP_TAGS, safeHtmlUrl,
} from "../lib/htmlPolicy";

const inlineTags = new Set(HTML_INLINE_TAGS);
const blockTags = new Set([...HTML_INLINE_TAGS, ...HTML_BLOCK_TAGS]);
const stripTags = new Set(HTML_STRIP_TAGS);
const htmlNamespace = "http://www.w3.org/1999/xhtml";

// Parsing in a template keeps resource loads and custom elements inert.
export function htmlTemplate(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

function imageSrc(value: string, filePath: string | null): string | null {
  const url = safeHtmlUrl(value, "image");
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!filePath) return null;
  const path = resolveAssetPath(filePath, url);
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

/** Copy only safe attributes onto a newly created element. Links are owned by the editor. */
function safeElement(source: Element, filePath: string | null): HTMLElement {
  const tag = source.localName;
  const el = document.createElement(tag);
  const copy = (name: string, valid?: RegExp) => {
    const value = source.getAttribute(name);
    if (value !== null && (!valid || valid.test(value))) el.setAttribute(name, value);
  };
  copy("title");
  if (tag === "a") {
    const url = safeHtmlUrl(source.getAttribute("href") ?? "", "link");
    if (url) {
      el.className = "cm-md-link";
      el.dataset.htmlHref = url;
      el.setAttribute("role", "link");
      el.tabIndex = 0;
    }
  } else if (tag === "img") {
    copy("alt");
    copy("width", HTML_IMAGE_SIZE);
    copy("height", HTML_IMAGE_SIZE);
    const src = imageSrc(source.getAttribute("src") ?? "", filePath);
    el.setAttribute("loading", "lazy");
    el.setAttribute("draggable", "false");
    if (src) el.setAttribute("src", src);
  } else if (tag === "details" && source.hasAttribute("open")) {
    el.setAttribute("open", "");
  } else if (tag === "ol") {
    copy("start", /^-?\d+$/);
  } else if (tag === "td" || tag === "th") {
    copy("colspan", HTML_IMAGE_SIZE);
    copy("rowspan", HTML_IMAGE_SIZE);
    copy("align", /^(left|center|right)$/i);
  }
  return el;
}

export function safeHtmlFragment(html: string, filePath: string | null): DocumentFragment {
  const result = document.createDocumentFragment();
  const append = (parent: HTMLElement | DocumentFragment, children: NodeListOf<ChildNode>) => {
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(node.textContent ?? "");
      } else if (node instanceof Element && node.namespaceURI === htmlNamespace && !stripTags.has(node.localName)) {
        if (blockTags.has(node.localName)) {
          const el = safeElement(node, filePath);
          append(el, node.childNodes);
          parent.append(el);
        } else {
          append(parent, node.childNodes);
        }
      }
    }
  };
  append(result, htmlTemplate(html).childNodes);
  return result;
}

// The cell renderer uses this token only outside Markdown code spans.
export const HTML_TAG_PATTERN = /<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])(?:[^"'<>\r\n]|"[^"\r\n]*"|'[^'\r\n]*')*>/gi;

export function safeInlineHtmlTag(token: string, name: string, closing: boolean, filePath: string | null): string | null {
  const tag = name.toLowerCase();
  if (!inlineTags.has(tag)) return null;
  if (closing) return tag === "br" || tag === "img" ? null : `</${tag}>`;
  const source = htmlTemplate(token).firstElementChild;
  if (!source || source.localName !== tag) return null;
  const html = safeElement(source, filePath).outerHTML;
  return tag === "br" || tag === "img" ? html : html.slice(0, html.lastIndexOf("</"));
}

export class InlineHtmlWidget extends WidgetType {
  constructor(readonly raw: string, readonly tag: "br" | "img", readonly filePath: string | null) { super(); }

  eq(other: InlineHtmlWidget) {
    return this.raw === other.raw && this.filePath === other.filePath;
  }

  get lineBreaks() { return this.tag === "br" ? 1 : 0; }

  toDOM(view: EditorView) {
    if (this.tag === "br") {
      const br = document.createElement("br");
      br.className = "md-html-break";
      return br;
    }
    const source = htmlTemplate(this.raw).firstElementChild;
    const image = source?.localName === "img" ? safeElement(source, this.filePath) : document.createElement("img");
    const wrap = document.createElement("span");
    wrap.className = "md-image-inline";
    image.addEventListener("load", () => view.requestMeasure());
    wrap.append(image);
    return wrap;
  }

  ignoreEvent() { return this.tag === "br"; }
}
