import { WidgetType } from "@codemirror/view";
import { stampBlockRange } from "./blockRange";
import {
  attachSourceEditing,
  beginSourceEditing,
  clickedOnBlockPadding,
  makePlainTextEditable,
} from "./editableSource";

/** YAML Front Matter：点进去直接改，不再只是一个只读摘要条 */
export class FrontMatterWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly body: string,
  ) {
    super();
  }

  eq(other: FrontMatterWidget) {
    return other.to - other.from === this.to - this.from && other.body === this.body;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-frontmatter-widget";
    stampBlockRange(wrap, this.from, this.to);

    const label = document.createElement("div");
    label.className = "md-frontmatter-label";
    label.contentEditable = "false";
    label.textContent = "YAML Front Matter";

    const source = document.createElement("div");
    source.className = "md-block-source md-frontmatter-source";
    makePlainTextEditable(source);
    source.textContent = this.body;

    // 外层只留白，视觉盒子在内层（根元素的 margin 会破坏高度测量）
    const box = document.createElement("div");
    box.className = "md-frontmatter-box";
    box.appendChild(label);
    box.appendChild(source);
    wrap.appendChild(box);

    attachSourceEditing(wrap, {
      source: () => source,
      toMarkdown: (text) => `---\n${text.replace(/\n+$/, "")}\n---`,
      indentOnTab: true,
    });

    wrap.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      if (!box.contains(target)) return;
      if (source.contains(target) || target === source) return;
      event.preventDefault();
      beginSourceEditing(wrap, source);
    });

    return wrap;
  }

  updateDOM(dom: HTMLElement) {
    const source = dom.querySelector<HTMLElement>(".md-block-source");
    if (!source) return false;
    stampBlockRange(dom, this.from, this.to);
    if (document.activeElement !== source && (source.textContent ?? "") !== this.body) {
      source.textContent = this.body;
    }
    return true;
  }

  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-frontmatter-widget");
  }
}
