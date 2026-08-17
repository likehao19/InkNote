import { WidgetType } from "@codemirror/view";
import mermaid from "mermaid";

let mermaidReady = false;

async function ensureMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
    securityLevel: "loose",
  });
  mermaidReady = true;
}

let idCounter = 0;

export class MermaidWidget extends WidgetType {
  readonly id = `mmd-${++idCounter}`;

  constructor(readonly code: string) {
    super();
  }

  eq(other: MermaidWidget) {
    return other.code === this.code;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-mermaid-widget";
    const inner = document.createElement("div");
    inner.className = "md-mermaid-inner";
    wrap.appendChild(inner);

    void (async () => {
      await ensureMermaid();
      try {
        const { svg } = await mermaid.render(this.id, this.code);
        inner.innerHTML = svg;
      } catch (e) {
        inner.textContent = `Mermaid 渲染失败: ${e instanceof Error ? e.message : String(e)}`;
        inner.classList.add("md-mermaid-error");
      }
    })();

    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}
