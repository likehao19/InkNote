import { WidgetType } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

export function parseTable(
  node: SyntaxNodeRef,
  doc: EditorState["doc"],
): { header: string[]; rows: string[][] } {
  const header: string[] = [];
  const rows: string[][] = [];

  for (const child of node.node.getChildren("TableHeader")) {
    for (const row of child.node.getChildren("TableRow")) {
      for (const cell of row.node.getChildren("TableCell")) {
        header.push(cellText(cell, doc));
      }
    }
  }

  for (const child of node.node.getChildren("TableRow")) {
    const row: string[] = [];
    for (const cell of child.node.getChildren("TableCell")) {
      row.push(cellText(cell, doc));
    }
    if (row.length) rows.push(row);
  }

  return { header, rows };
}

function cellText(cell: { from: number; to: number }, doc: EditorState["doc"]): string {
  return doc.sliceString(cell.from, cell.to).trim();
}

export class TableWidget extends WidgetType {
  constructor(
    readonly header: string[],
    readonly rows: string[][],
  ) {
    super();
  }

  eq(other: TableWidget) {
    return (
      other.header.join() === this.header.join() &&
      other.rows.map((r) => r.join()).join() === this.rows.map((r) => r.join()).join()
    );
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-table-widget";
    const table = document.createElement("table");

    if (this.header.length) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      for (const h of this.header) {
        const th = document.createElement("th");
        th.textContent = h;
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    for (const row of this.rows) {
      const tr = document.createElement("tr");
      for (const cell of row) {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}
