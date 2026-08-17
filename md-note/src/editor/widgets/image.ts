import { WidgetType } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SyntaxNodeRef } from "@lezer/common";

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly resolved: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM() {
    const figure = document.createElement("figure");
    figure.className = "md-image-widget";
    const img = document.createElement("img");
    img.alt = this.alt;
    img.loading = "lazy";

    if (/^https?:\/\//i.test(this.resolved) || /^data:/i.test(this.resolved)) {
      img.src = this.resolved;
    } else {
      try {
        img.src = convertFileSrc(this.resolved);
      } catch {
        img.src = this.resolved;
      }
    }

    img.onerror = () => {
      img.style.display = "none";
      const err = document.createElement("span");
      err.className = "md-image-error";
      err.textContent = `无法加载: ${this.src}`;
      figure.appendChild(err);
    };

    figure.appendChild(img);
    if (this.alt) {
      const cap = document.createElement("figcaption");
      cap.textContent = this.alt;
      figure.appendChild(cap);
    }
    return figure;
  }

  ignoreEvent() {
    return false;
  }
}

/** 从 Image 语法节点提取 alt 与 url */
export function parseImage(
  node: SyntaxNodeRef,
  doc: { sliceString: (f: number, t: number) => string },
): { alt: string; url: string } {
  const text = doc.sliceString(node.from, node.to);
  const m = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(text);
  if (m) return { alt: m[1], url: m[2] };
  let alt = "";
  let url = "";
  for (const c of node.node.getChildren("LinkLabel")) {
    alt = doc.sliceString(c.from, c.to);
  }
  for (const c of node.node.getChildren("URL")) {
    url = doc.sliceString(c.from, c.to);
  }
  return { alt, url };
}
