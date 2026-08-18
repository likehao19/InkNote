import { WidgetType } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SyntaxNodeRef } from "@lezer/common";
import { bindBlockClickEdit } from "./blockRange";

export class ImageWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly src: string,
    readonly alt: string,
    readonly resolved: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.src === this.src &&
      other.alt === this.alt &&
      other.resolved === this.resolved
    );
  }

  toDOM() {
    const figure = document.createElement("figure");
    figure.className = "md-image-widget";
    bindBlockClickEdit(figure, this.from, this.to);

    const img = document.createElement("img");
    img.alt = this.alt;
    img.loading = "lazy";
    img.draggable = false;

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

    const pathHint = document.createElement("span");
    pathHint.className = "md-image-path-hint";
    pathHint.textContent = this.src;
    pathHint.setAttribute("aria-hidden", "true");

    figure.appendChild(img);
    figure.appendChild(pathHint);
    return figure;
  }

  ignoreEvent() {
    return true;
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
