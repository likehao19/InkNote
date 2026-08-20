import { WidgetType, EditorView } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SyntaxNodeRef } from "@lezer/common";
import { bindBlockClickEdit, currentBlockRange, stampBlockRange } from "./blockRange";
import { attachBlockSelection } from "./editableSource";
import { pendingImageUrl } from "../../lib/pendingImages";
import { editorPickImage } from "../../lib/editorBridge";

export class ImageWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly src: string,
    readonly alt: string,
    readonly resolved: string,
    readonly inline = false,
  ) {
    super();
  }

  /** 只比较内容与长度：位置变化不应导致图片重新加载 */
  eq(other: ImageWidget) {
    return (
      other.to - other.from === this.to - this.from &&
      other.src === this.src &&
      other.alt === this.alt &&
      other.resolved === this.resolved &&
      other.inline === this.inline
    );
  }

  private buildImage(): HTMLImageElement {
    const img = document.createElement("img");
    img.alt = this.alt;
    img.loading = "lazy";
    img.draggable = false;

    // 文档还没保存时粘贴进来的图片：直接用内存里的 blob URL 回显
    const pending = pendingImageUrl(this.src);
    if (pending) {
      img.src = pending;
    } else if (/^https?:\/\//i.test(this.resolved) || /^data:/i.test(this.resolved)) {
      img.src = this.resolved;
    } else {
      try {
        img.src = convertFileSrc(this.resolved);
      } catch {
        img.src = this.resolved;
      }
    }
    return img;
  }

  toDOM() {
    const root = document.createElement(this.inline ? "span" : "figure");
    root.className = this.inline ? "md-image-inline" : "md-image-widget";
    stampBlockRange(root, this.from, this.to);

    const img = this.buildImage();
    img.onload = () => {
      // 图片是异步变高的，不通知 CodeMirror 重新测量，
      // 之后所有点击定位都会偏掉
      EditorView.findFromDOM(root)?.requestMeasure();
    };
    img.onerror = () => {
      img.style.display = "none";
      const err = document.createElement("span");
      err.className = "md-image-error";
      err.textContent = `无法加载: ${this.src}`;
      root.appendChild(err);
      EditorView.findFromDOM(root)?.requestMeasure();
    };
    root.appendChild(img);

    if (this.inline) {
      // 行内图片跟其它行内标记一致：点击露出源码
      bindBlockClickEdit(root, this.from, this.to);
      return root;
    }

    const hint = document.createElement("span");
    hint.className = "md-image-path-hint";
    hint.textContent = `${this.src} · 双击编辑`;
    hint.setAttribute("aria-hidden", "true");
    root.appendChild(hint);

    // 块级图片：点击选中而不是把 Markdown 源码翻出来
    attachBlockSelection(root, {
      onEdit: (view, wrap) => {
        void (async () => {
          const picked = await editorPickImage(this.alt);
          if (!picked || !picked.path.trim()) return;
          const range = currentBlockRange(view, wrap);
          if (!range) return;
          view.dispatch({
            changes: {
              from: range.from,
              to: range.to,
              insert: `![${picked.alt}](${picked.path.trim()})`,
            },
            userEvent: "input.block",
          });
          view.focus();
        })();
      },
    });

    return root;
  }

  // 不实现 updateDOM：内容变了（换图/改 alt）必须重建，否则 <img> 不会刷新
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
