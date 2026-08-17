import { WidgetType } from "@codemirror/view";

export class FrontMatterWidget extends WidgetType {
  constructor(readonly summary: string) {
    super();
  }

  eq(other: FrontMatterWidget) {
    return other.summary === this.summary;
  }

  toDOM() {
    const el = document.createElement("div");
    el.className = "md-frontmatter-widget";
    el.textContent = summaryLabel(this.summary);
    return el;
  }

  ignoreEvent() {
    return false;
  }
}

function summaryLabel(summary: string): string {
  return summary ? `YAML · ${summary}` : "YAML Front Matter";
}
