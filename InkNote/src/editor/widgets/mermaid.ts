import { WidgetType, EditorView } from "@codemirror/view";
import { bindBlockBoundaryCursor, stampBlockRange } from "./blockRange";
import { configuredMermaid } from "../../lib/mermaid";
import {
  attachSourceEditing,
  beginSourceEditing,
  clickedOnBlockPadding,
  makePlainTextEditable,
} from "./editableSource";
import { getLocale, t } from "../../lib/i18n";

function currentTheme(): "dark" | "default" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default";
}

let idCounter = 0;

/** 渲染是异步且偏慢的，输入过程中做防抖 */
function renderMermaid(target: HTMLElement, code: string) {
  const token = String(++idCounter);
  target.dataset.renderToken = token;

  void (async () => {
    const mermaid = await configuredMermaid(currentTheme());
    if (target.dataset.renderToken !== token || !target.isConnected) return;
    if (!code.trim()) {
      target.textContent = t(getLocale(), "editor.mermaid.empty");
      target.classList.add("md-mermaid-error");
      return;
    }
    try {
      const { svg } = await mermaid.render(`mmd-${token}`, code);
      if (target.dataset.renderToken !== token || !target.isConnected) return;
      target.innerHTML = svg;
      target.classList.remove("md-mermaid-error");
    } catch (e) {
      if (target.dataset.renderToken !== token || !target.isConnected) return;
      target.textContent = t(getLocale(), "editor.mermaid.error", {
        message: e instanceof Error ? e.message : String(e),
      });
      target.classList.add("md-mermaid-error");
    }
    // 图表是异步出现的，高度变了必须让 CodeMirror 重新测量，否则点击定位会偏
    EditorView.findFromDOM(target)?.requestMeasure();
  })();
}

export class MermaidWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly code: string,
  ) {
    super();
  }

  /** 只比较内容与长度：位置变化不应触发整图重绘 */
  eq(other: MermaidWidget) {
    return other.to - other.from === this.to - this.from && other.code === this.code;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-mermaid-widget";
    stampBlockRange(wrap, this.from, this.to);

    const source = document.createElement("div");
    source.className = "md-block-source";
    makePlainTextEditable(source);
    source.textContent = this.code;

    const inner = document.createElement("div");
    inner.className = "md-mermaid-inner";
    renderMermaid(inner, this.code);

    // 外层只留白，视觉盒子在内层（根元素的 margin 会破坏高度测量）
    const box = document.createElement("div");
    box.className = "md-mermaid-box";
    box.appendChild(source);
    box.appendChild(inner);
    wrap.appendChild(box);
    bindBlockBoundaryCursor(wrap, box);

    let debounce = 0;
    attachSourceEditing(wrap, {
      source: () => source,
      toMarkdown: (text) => `\`\`\`mermaid\n${text.replace(/\n+$/, "")}\n\`\`\``,
      onInput: (text) => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => renderMermaid(inner, text), 400);
      },
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
    const inner = dom.querySelector<HTMLElement>(".md-mermaid-inner");
    if (!source || !inner) return false;

    stampBlockRange(dom, this.from, this.to);
    if (document.activeElement !== source) {
      if ((source.textContent ?? "") !== this.code) source.textContent = this.code;
      renderMermaid(inner, this.code);
    }
    return true;
  }

  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-mermaid-widget");
  }
}
