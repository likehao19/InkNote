import { WidgetType } from "@codemirror/view";
import { bindBlockClickEdit } from "./blockRange";

export class FrontMatterWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly summary: string,
  ) {
    super();
  }

  eq(other: FrontMatterWidget) {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.summary === this.summary
    );
  }

  toDOM() {
    const el = document.createElement("div");
    el.className = "md-frontmatter-widget";
    el.textContent = summaryLabel(this.summary);
    bindBlockClickEdit(el, this.from, this.to);
    return el;
  }

  ignoreEvent() {
    return true;
  }
}

function summaryLabel(summary: string): string {
  return summary ? `YAML · ${summary}` : "YAML Front Matter";
}
