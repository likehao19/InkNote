import { WidgetType, EditorView, Decoration } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { EditorSelection, EditorState, type Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNodeRef } from "@lezer/common";
import { getLocale, t } from "../../lib/i18n";
import { getConfirmDelete } from "../../lib/preferences";
import { bindBlockClickEdit } from "./blockRange";

export type TableAlign = "left" | "center" | "right";

export interface TableRange {
  from: number;
  to: number;
}

export interface TableData {
  header: string[];
  rows: string[][];
  aligns: TableAlign[];
}

/** 按未转义的 | 拆分单元格，支持 \| */
function splitTableCells(line: string): string[] {
  let inner = line.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && inner[i + 1] === "|") {
      current += "|";
      i++;
    } else if (inner[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += inner[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseRow(line: string): string[] {
  return splitTableCells(line);
}

function isDelimiterLine(line: string): boolean {
  return /^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?\|?\s*$/.test(line.trim());
}

function parseAlignments(line: string): TableAlign[] {
  let inner = line.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map((cell) => {
    const s = cell.trim();
    if (s.startsWith(":") && s.endsWith(":")) return "center";
    if (s.endsWith(":")) return "right";
    return "left";
  });
}

export function parseTable(
  node: SyntaxNodeRef | TableRange,
  doc: EditorState["doc"],
): TableData {
  const text = doc.sliceString(node.from, node.to);
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { header: [], rows: [], aligns: [] };
  }

  const header = parseRow(lines[0]);
  let aligns: TableAlign[] = [];
  let bodyStart = 1;
  if (isDelimiterLine(lines[1])) {
    aligns = parseAlignments(lines[1]);
    bodyStart = 2;
  }

  const rows: string[][] = [];
  for (let i = bodyStart; i < lines.length; i++) {
    rows.push(parseRow(lines[i]));
  }

  const colCount = Math.max(header.length, aligns.length, ...rows.map((r) => r.length), 1);
  while (header.length < colCount) header.push("");
  while (aligns.length < colCount) aligns.push("left");

  return { header, rows, aligns };
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function delimCell(align: TableAlign): string {
  switch (align) {
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

/** 生成 rows×cols 的空表格 Markdown（首行为表头） */
export function buildEmptyTable(rows: number, cols: number): string {
  const r = Math.max(1, rows);
  const c = Math.max(1, cols);
  const header = Array(c).fill("");
  const body = Array(Math.max(0, r - 1))
    .fill(null)
    .map(() => Array(c).fill(""));
  const aligns = Array(c).fill("left") as TableAlign[];
  return serializeTable(header, body, aligns);
}

export function insertTableAtCursor(
  view: EditorView,
  rows: number,
  cols: number,
): boolean {
  const text = buildEmptyTable(rows, cols);
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const prefix = line.text.length > 0 ? "\n\n" : "";
  const insert = `${prefix}${text}`;
  const at = line.to;
  const tableFrom = at + prefix.length;
  const tableTo = at + insert.length;
  view.dispatch({
    changes: { from: at, insert },
    selection: { anchor: tableTo },
    scrollIntoView: true,
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      focusTableCellAt(view, { from: tableFrom, to: tableTo }, 0, 0);
    });
  });
  return true;
}

export function serializeTable(
  header: string[],
  rows: string[][],
  aligns: TableAlign[] = [],
): string {
  const colCount = Math.max(
    header.length,
    rows.reduce((max, row) => Math.max(max, row.length), 0),
    aligns.length,
    1,
  );
  const padRow = (cells: string[]) => {
    const row = cells.map(escapeCell);
    while (row.length < colCount) row.push("");
    return row;
  };
  const line = (cells: string[]) => `| ${padRow(cells).join(" | ")} |`;
  const alignRow = [...aligns];
  while (alignRow.length < colCount) alignRow.push("left");
  const delim = `| ${alignRow.map(delimCell).join(" | ")} |`;

  const headerRow = header.length ? header : Array(colCount).fill("");
  const lines = [line(headerRow), delim];
  for (const row of rows) lines.push(line(row));
  return lines.join("\n");
}

export function iterTables(state: EditorState): TableRange[] {
  const tables: TableRange[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "Table") {
        tables.push({ from: node.from, to: node.to });
      }
    },
  });
  return tables;
}

export function cellColAtPos(lineText: string, lineFrom: number, pos: number): number {
  let col = 0;
  let i = 0;
  while (i < lineText.length && lineText[i] === " ") i++;
  if (lineText[i] === "|") i++;
  let cellStart = i;

  for (; i < lineText.length; ) {
    if (lineText[i] === "\\" && lineText[i + 1] === "|") {
      i += 2;
      continue;
    }
    if (lineText[i] === "|") {
      const cellFrom = lineFrom + cellStart;
      const cellTo = lineFrom + i;
      if (pos >= cellFrom && pos <= cellTo) return col;
      col++;
      i++;
      while (i < lineText.length && lineText[i] === " ") i++;
      cellStart = i;
      continue;
    }
    i++;
  }
  if (pos >= lineFrom + cellStart) return col;
  return 0;
}

function tableRowAtLine(state: EditorState, tableFrom: number, lineNumber: number): number | null {
  const startLine = state.doc.lineAt(tableFrom).number;
  const rel = lineNumber - startLine;
  if (rel === 0) return 0;
  if (rel === 1) {
    const delim = state.doc.line(startLine + 1);
    if (delim && isDelimiterLine(delim.text)) return null;
  }
  const hasDelim = (() => {
    const l = state.doc.line(startLine + 1);
    return l && isDelimiterLine(l.text);
  })();
  if (hasDelim) return rel - 1;
  return rel;
}

export interface TableCursorContext {
  range: TableRange;
  data: TableData;
  row: number;
  col: number;
}

export function getTableAtCursor(state: EditorState, pos: number): TableCursorContext | null {
  let from = -1;
  let to = -1;
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "Table" && node.from <= pos && node.to >= pos) {
        from = node.from;
        to = node.to;
        return false;
      }
    },
  });
  if (from < 0) return null;

  const range = { from, to };
  const line = state.doc.lineAt(pos);
  if (isDelimiterLine(line.text)) return null;

  const row = tableRowAtLine(state, from, line.number);
  if (row === null) return null;

  const data = parseTable(range, state.doc);
  const col = cellColAtPos(line.text, line.from, pos);
  return { range, data, row, col };
}

export type TableEditAction =
  | "row-below"
  | "row-above"
  | "row-delete"
  | "col-left"
  | "col-right"
  | "col-delete"
  | "align-left"
  | "align-center"
  | "align-right"
  | "delete";

interface CellPosition {
  row: number;
  col: number;
}

export function mutateTableData(
  data: TableData,
  row: number,
  col: number,
  action: TableEditAction,
): { data: TableData; focus: CellPosition } | null {
  const next: TableData = {
    header: [...data.header],
    rows: data.rows.map((r) => [...r]),
    aligns: [...data.aligns],
  };
  const cols = colCount(next);
  const empty = emptyRow(cols);
  const isHeader = row === 0;

  switch (action) {
    case "row-above": {
      let focusRow = row;
      if (isHeader) {
        next.rows.unshift([...next.header]);
        next.header = empty;
        focusRow = 0;
      } else {
        next.rows.splice(row - 1, 0, empty);
        focusRow = row;
      }
      return { data: next, focus: { row: focusRow, col } };
    }
    case "row-below": {
      let focusRow = 1;
      if (isHeader) {
        next.rows.splice(0, 0, empty);
        focusRow = 1;
      } else {
        next.rows.splice(row, 0, empty);
        focusRow = row + 1;
      }
      return { data: next, focus: { row: focusRow, col } };
    }
    case "row-delete": {
      if (isHeader) {
        if (next.rows.length === 0) return null;
        next.header = [...next.rows[0]];
        next.rows.shift();
        return { data: next, focus: { row: 0, col } };
      }
      next.rows.splice(row - 1, 1);
      return { data: next, focus: { row: Math.min(row, next.rows.length), col } };
    }
    case "col-left": {
      const at = col;
      next.header.splice(at, 0, "");
      next.aligns.splice(at, 0, "left");
      for (const r of next.rows) r.splice(at, 0, "");
      return { data: next, focus: { row, col: at } };
    }
    case "col-right": {
      const at = col + 1;
      next.header.splice(at, 0, "");
      next.aligns.splice(at, 0, "left");
      for (const r of next.rows) r.splice(at, 0, "");
      return { data: next, focus: { row, col: at } };
    }
    case "col-delete": {
      if (cols <= 1) return null;
      next.header.splice(col, 1);
      next.aligns.splice(col, 1);
      for (const r of next.rows) r.splice(col, 1);
      return { data: next, focus: { row, col: Math.min(col, colCount(next) - 1) } };
    }
    case "align-left":
    case "align-center":
    case "align-right": {
      const align = action.slice("align-".length) as TableAlign;
      while (next.aligns.length <= col) next.aligns.push("left");
      next.aligns[col] = align;
      return { data: next, focus: { row, col } };
    }
    case "delete":
      return null;
    default:
      return null;
  }
}

export function mutateTableInView(view: EditorView, action: TableEditAction): boolean {
  if (action === "delete") {
    const ctx = getTableAtCursor(view.state, view.state.selection.main.head);
    if (!ctx) return false;
    if (getConfirmDelete()) {
      const locale = getLocale();
      if (!window.confirm(t(locale, "confirm.deleteTable"))) return false;
    }
    let end = ctx.range.to;
    if (end < view.state.doc.length && view.state.doc.sliceString(end, end + 1) === "\n") {
      end += 1;
    }
    view.dispatch({
      changes: { from: ctx.range.from, to: end, insert: "" },
      selection: { anchor: ctx.range.from },
      scrollIntoView: true,
    });
    view.focus();
    return true;
  }

  const ctx = getTableAtCursor(view.state, view.state.selection.main.head);
  if (!ctx) return false;
  const result = mutateTableData(ctx.data, ctx.row, ctx.col, action);
  if (!result) return false;

  const insert = serializeTable(result.data.header, result.data.rows, result.data.aligns);
  view.dispatch({
    changes: { from: ctx.range.from, to: ctx.range.to, insert },
    selection: { anchor: ctx.range.from },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function positionAfterTable(state: EditorState, tableTo: number): number {
  if (tableTo < state.doc.length && state.doc.sliceString(tableTo, tableTo + 1) === "\n") {
    return tableTo + 1;
  }
  return tableTo;
}

function tablesEndingAtLine(state: EditorState): Map<number, TableRange> {
  const map = new Map<number, TableRange>();
  for (const table of iterTables(state)) {
    map.set(state.doc.lineAt(table.to).number, table);
  }
  return map;
}

function tablesStartingAtLine(state: EditorState): Map<number, TableRange> {
  const map = new Map<number, TableRange>();
  for (const table of iterTables(state)) {
    map.set(state.doc.lineAt(table.from).number, table);
  }
  return map;
}

export function tableEndingBefore(state: EditorState, pos: number): TableRange | null {
  const line = state.doc.lineAt(pos);
  if (pos !== line.from) return null;

  const byEndLine = tablesEndingAtLine(state);
  let scanFrom = line.from - 1;
  if (scanFrom < 0) return null;

  while (scanFrom >= 0) {
    const scanLine = state.doc.lineAt(scanFrom);
    if (scanLine.text.trim().length > 0) {
      return byEndLine.get(scanLine.number) ?? null;
    }
    scanFrom = scanLine.from - 1;
  }
  return null;
}

export function tableStartingAfter(state: EditorState, pos: number): TableRange | null {
  const line = state.doc.lineAt(pos);
  if (pos !== line.to) return null;

  const byStartLine = tablesStartingAtLine(state);
  let scanFrom = line.to + 1;
  if (scanFrom > state.doc.length) return null;

  while (scanFrom <= state.doc.length) {
    const scanLine = state.doc.lineAt(scanFrom);
    if (scanLine.text.trim().length > 0) {
      return byStartLine.get(scanLine.number) ?? null;
    }
    scanFrom = scanLine.to + 1;
  }
  return null;
}

function readAligns(wrap: HTMLElement): TableAlign[] {
  const raw = wrap.dataset.tableAligns ?? "";
  if (!raw) return [];
  return raw.split(",").map((a) => {
    if (a === "center" || a === "right") return a;
    return "left";
  });
}

function writeAligns(wrap: HTMLElement, aligns: TableAlign[]) {
  wrap.dataset.tableAligns = aligns.join(",");
}

function readTableFromDom(wrap: HTMLElement): TableData {
  const header: string[] = [];
  wrap.querySelectorAll("thead th").forEach((th) => {
    header.push(th.textContent ?? "");
  });

  const rows: string[][] = [];
  wrap.querySelectorAll("tbody tr").forEach((tr) => {
    const row: string[] = [];
    tr.querySelectorAll("td").forEach((td) => {
      row.push(td.textContent ?? "");
    });
    if (row.length) rows.push(row);
  });

  return { header, rows, aligns: readAligns(wrap) };
}

function colCount(data: TableData): number {
  return Math.max(
    data.header.length,
    data.aligns.length,
    data.rows.reduce((max, row) => Math.max(max, row.length), 0),
    1,
  );
}

function emptyRow(cols: number): string[] {
  return Array(cols).fill("");
}

function getEditableCells(wrap: Element): HTMLElement[] {
  return Array.from(
    wrap.querySelectorAll<HTMLElement>("th[contenteditable], td[contenteditable]"),
  );
}

function isEditingTableCell(): boolean {
  const el = document.activeElement;
  return !!el?.closest(
    ".md-table-widget th[contenteditable], .md-table-widget td[contenteditable]",
  );
}

interface CellInfo {
  cell: HTMLElement;
  row: number;
  col: number;
  isHeader: boolean;
}

function getFocusedCellInfo(wrap: HTMLElement): CellInfo | null {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !wrap.contains(active)) return null;
  if (active.tagName !== "TH" && active.tagName !== "TD") return null;

  const isHeader = active.tagName === "TH";
  const tr = active.closest("tr");
  if (!tr) return null;
  const col = Array.from(tr.children).indexOf(active);
  let row = 0;
  if (!isHeader) {
    const tbody = tr.parentElement;
    row = 1 + (tbody ? Array.from(tbody.children).indexOf(tr) : 0);
  }
  return { cell: active, row, col, isHeader };
}

function isCaretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return true;
  const probe = range.cloneRange();
  probe.selectNodeContents(el);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
}

function isCaretAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.endContainer)) return true;
  const probe = range.cloneRange();
  probe.selectNodeContents(el);
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().length === 0;
}

function placeCaret(cell: HTMLElement, atEnd: boolean) {
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(!atEnd);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function focusAdjacentCell(cell: HTMLElement, backward: boolean) {
  const wrap = cell.closest(".md-table-widget");
  if (!wrap) return;
  const cells = getEditableCells(wrap);
  const idx = cells.indexOf(cell);
  if (idx < 0) return;
  const next = backward ? cells[idx - 1] : cells[idx + 1];
  if (!next) return;
  next.focus();
  placeCaret(next, !backward);
}

function cellIndexFromRowCol(wrap: HTMLElement, row: number, col: number): number {
  const rowLen =
    wrap.querySelectorAll("thead tr th").length ||
    wrap.querySelectorAll("tbody tr:first-child td").length ||
    1;
  if (row === 0) return col;
  return rowLen + (row - 1) * rowLen + col;
}

function updateActiveColumn(wrap: HTMLElement, col: number) {
  wrap.querySelectorAll<HTMLElement>(".md-table-col-active").forEach((el) => {
    el.classList.remove("md-table-col-active");
  });
  wrap.querySelectorAll<HTMLElement>(`[data-col="${col}"]`).forEach((el) => {
    el.classList.add("md-table-col-active");
  });
}

function focusCellOnWrap(wrap: HTMLElement, row: number, col: number, atEnd = false) {
  const cells = getEditableCells(wrap);
  const idx = cellIndexFromRowCol(wrap, row, col);
  const cell = cells[idx];
  if (!cell) return;
  wrap.classList.add("md-table-widget--focused");
  updateActiveColumn(wrap, col);
  cell.focus();
  placeCaret(cell, atEnd);
}

const pendingFocusByTable = new Map<number, CellPosition>();

export function focusTableCellAt(
  view: EditorView,
  table: TableRange,
  row: number,
  col: number,
  atEnd = false,
): boolean {
  view.dispatch({
    selection: { anchor: positionAfterTable(view.state, table.to) },
  });

  requestAnimationFrame(() => {
    const wrap = view.dom.querySelector(
      `.md-table-widget[data-table-from="${table.from}"]`,
    ) as HTMLElement | null;
    if (!wrap) return;
    focusCellOnWrap(wrap, row, col, atEnd);
  });
  return true;
}

export function focusTableCell(
  view: EditorView,
  table: TableRange,
  last: boolean,
): boolean {
  view.dispatch({
    selection: { anchor: positionAfterTable(view.state, table.to) },
  });

  requestAnimationFrame(() => {
    const wrap = view.dom.querySelector(
      `.md-table-widget[data-table-from="${table.from}"]`,
    ) as HTMLElement | null;
    if (!wrap) return;
    const cells = getEditableCells(wrap);
    if (!cells.length) return;
    if (last) {
      const rowLen =
        wrap.querySelectorAll("thead tr th").length ||
        wrap.querySelectorAll("tbody tr:first-child td").length ||
        1;
      const idx = cells.length - 1;
      focusCellOnWrap(wrap, Math.floor(idx / rowLen), idx % rowLen, true);
    } else {
      focusCellOnWrap(wrap, 0, 0, false);
    }
  });
  return true;
}

function snapOutsideTable(
  state: EditorState,
  pos: number,
  selFrom: number,
  selTo: number,
): number {
  for (const table of iterTables(state)) {
    if (pos > table.from && pos < table.to) {
      // 光标已在表格源码内（预览 Widget 已隐藏）时允许精确定位
      const editingSource = table.from <= selTo && selFrom < table.to;
      if (editingSource) return pos;

      const mid = (table.from + table.to) / 2;
      return pos >= mid
        ? positionAfterTable(state, table.to)
        : table.from;
    }
  }
  return pos;
}

let tableSyncing = false;
const syncFrames = new Map<HTMLElement, number>();

function applyTableData(
  wrap: HTMLElement,
  view: EditorView,
  data: TableData,
  focusAt?: CellPosition,
) {
  const cols = colCount(data);
  while (data.header.length < cols) data.header.push("");
  while (data.aligns.length < cols) data.aligns.push("left");
  for (const row of data.rows) while (row.length < cols) row.push("");

  writeAligns(wrap, data.aligns);
  if (focusAt) {
    const from = Number(wrap.dataset.tableFrom);
    if (!Number.isNaN(from)) pendingFocusByTable.set(from, focusAt);
  }
  syncTableFromDom(wrap, view, data);
}

function syncTableFromDom(wrap: HTMLElement, view: EditorView, data?: TableData) {
  const from = Number(wrap.dataset.tableFrom);
  const to = Number(wrap.dataset.tableTo);
  if (Number.isNaN(from) || Number.isNaN(to)) return;

  const tableData = data ?? readTableFromDom(wrap);
  const insert = serializeTable(tableData.header, tableData.rows, tableData.aligns);
  const current = view.state.doc.sliceString(from, to);
  if (current === insert) return;

  tableSyncing = true;
  try {
    view.dispatch({
      changes: { from, to, insert },
    });
  } finally {
    tableSyncing = false;
  }
}

function scheduleSync(wrap: HTMLElement, view: EditorView) {
  const existing = syncFrames.get(wrap);
  if (existing) cancelAnimationFrame(existing);
  const id = requestAnimationFrame(() => {
    syncFrames.delete(wrap);
    syncTableFromDom(wrap, view);
  });
  syncFrames.set(wrap, id);
}

function exitTableToLineAbove(view: EditorView, wrap: HTMLElement) {
  syncTableFromDom(wrap, view);
  const from = Number(wrap.dataset.tableFrom);
  if (Number.isNaN(from)) return;
  const line = view.state.doc.lineAt(from);
  let pos = line.from;
  if (line.number > 1) {
    pos = view.state.doc.line(line.number - 1).to;
  }
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
}

function exitTableToLineBelow(view: EditorView, wrap: HTMLElement) {
  syncTableFromDom(wrap, view);
  const to = Number(wrap.dataset.tableTo);
  if (Number.isNaN(to)) return;
  const pos = positionAfterTable(view.state, to);
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
}

function insertRowAbove(wrap: HTMLElement, view: EditorView) {
  applyTableEdit(wrap, view, "row-above");
}

function insertRowBelow(wrap: HTMLElement, view: EditorView) {
  applyTableEdit(wrap, view, "row-below");
}

function insertCol(wrap: HTMLElement, view: EditorView, side: "left" | "right") {
  applyTableEdit(wrap, view, side === "left" ? "col-left" : "col-right");
}

function deleteRow(wrap: HTMLElement, view: EditorView) {
  applyTableEdit(wrap, view, "row-delete");
}

function deleteCol(wrap: HTMLElement, view: EditorView) {
  applyTableEdit(wrap, view, "col-delete");
}

function setColumnAlign(wrap: HTMLElement, view: EditorView, align: TableAlign) {
  const action =
    align === "center" ? "align-center" : align === "right" ? "align-right" : "align-left";
  applyTableEdit(wrap, view, action);
}

function applyTableEdit(wrap: HTMLElement, view: EditorView, action: TableEditAction) {
  const info = getFocusedCellInfo(wrap);
  const data = readTableFromDom(wrap);
  const row = info?.row ?? 0;
  const col = info?.col ?? 0;
  const result = mutateTableData(data, row, col, action);
  if (!result) return;
  applyTableData(wrap, view, result.data, result.focus);
}

function deleteTable(wrap: HTMLElement, view: EditorView) {
  if (getConfirmDelete()) {
    const locale = getLocale();
    if (!window.confirm(t(locale, "confirm.deleteTable"))) return;
  }
  const from = Number(wrap.dataset.tableFrom);
  const to = Number(wrap.dataset.tableTo);
  if (Number.isNaN(from) || Number.isNaN(to)) return;
  let end = to;
  if (end < view.state.doc.length && view.state.doc.sliceString(end, end + 1) === "\n") {
    end += 1;
  }
  view.dispatch({
    changes: { from, to: end, insert: "" },
    selection: { anchor: from },
  });
  view.focus();
}

function handleToolbarAction(wrap: HTMLElement, view: EditorView, action: string) {
  switch (action) {
    case "row-below":
      insertRowBelow(wrap, view);
      break;
    case "row-above":
      insertRowAbove(wrap, view);
      break;
    case "row-delete":
      deleteRow(wrap, view);
      break;
    case "col-left":
      insertCol(wrap, view, "left");
      break;
    case "col-right":
      insertCol(wrap, view, "right");
      break;
    case "col-delete":
      deleteCol(wrap, view);
      break;
    case "align-left":
      setColumnAlign(wrap, view, "left");
      break;
    case "align-center":
      setColumnAlign(wrap, view, "center");
      break;
    case "align-right":
      setColumnAlign(wrap, view, "right");
      break;
    case "delete":
      deleteTable(wrap, view);
      break;
  }
}

/** Backspace：表格下方行首时进入最后一格 */
export function tableBackspace(view: EditorView): boolean {
  if (isEditingTableCell()) return false;
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  if (head !== line.from) return false;

  const table = tableEndingBefore(state, head);
  if (!table) return false;

  if (line.text.length === 0 && line.to < state.doc.length) {
    view.dispatch({
      changes: { from: line.from, to: line.to + 1 },
    });
    const nextTable = tableEndingBefore(view.state, view.state.selection.main.head);
    if (nextTable) {
      requestAnimationFrame(() => focusTableCell(view, nextTable, true));
    }
    return true;
  }

  return focusTableCell(view, table, true);
}

/** Delete：表格上方行末时进入第一格 */
export function tableDeleteKey(view: EditorView): boolean {
  if (isEditingTableCell()) return false;
  const { state } = view;
  const { head } = state.selection.main;
  const table = tableStartingAfter(state, head);
  if (!table) return false;
  return focusTableCell(view, table, false);
}

/** 预览模式下表格为原子块，光标不落在表格源码内 */
export function tableSelectionSnap(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.selection || isEditingTableCell()) return tr;

    let changed = false;
    const ranges = tr.selection.ranges.map((range) => {
      const selFrom = Math.min(range.anchor, range.head);
      const selTo = Math.max(range.anchor, range.head);
      const anchor = snapOutsideTable(tr.startState, range.anchor, selFrom, selTo);
      const head = snapOutsideTable(tr.startState, range.head, selFrom, selTo);
      if (anchor === range.anchor && head === range.head) return range;
      changed = true;
      return EditorSelection.range(anchor, head);
    });

    if (!changed) return tr;
    return [{ ...tr, selection: EditorSelection.create(ranges) }];
  });
}

function closeAllTableMenus(except?: Element) {
  document.querySelectorAll(".md-table-toolbar-menu.is-open").forEach((menu) => {
    if (menu !== except) menu.classList.remove("is-open");
  });
}

/** 表格单元格 contenteditable 与 Markdown 源码同步 */
export function tableEditingHandlers(): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, _view) {
      if (event.button !== 0) return false;

      const wrap = (event.target as HTMLElement).closest(".md-table-widget") as
        | HTMLElement
        | null;
      if (!wrap) return false;

      if ((event.target as HTMLElement).closest(".md-table-toolbar")) {
        return false;
      }

      const cell = (event.target as HTMLElement).closest(
        "th[contenteditable], td[contenteditable]",
      ) as HTMLElement | null;

      if (cell) {
        wrap.classList.add("md-table-widget--focused");
        const col = Array.from(cell.parentElement?.children ?? []).indexOf(cell);
        if (col >= 0) updateActiveColumn(wrap, col);
        event.preventDefault();
        event.stopPropagation();
        cell.focus();
        return true;
      }

      return false;
    },
    focusin(event) {
      const wrap = (event.target as HTMLElement).closest(".md-table-widget");
      if (wrap) wrap.classList.add("md-table-widget--focused");
    },
    focusout(event) {
      const wrap = (event.target as HTMLElement).closest(".md-table-widget") as HTMLElement | null;
      if (!wrap) return false;
      requestAnimationFrame(() => {
        if (!wrap.contains(document.activeElement)) {
          wrap.classList.remove("md-table-widget--focused");
          closeAllTableMenus();
        }
      });
      return false;
    },
    input(event, view) {
      if (tableSyncing) return false;
      const target = event.target as HTMLElement;
      const cell = target.closest(
        ".md-table-widget th[contenteditable], .md-table-widget td[contenteditable]",
      );
      if (!cell) return false;
      const wrap = cell.closest(".md-table-widget") as HTMLElement | null;
      if (!wrap) return false;
      scheduleSync(wrap, view);
      return true;
    },
    blur(event, view) {
      if (tableSyncing) return false;
      const target = event.target as HTMLElement;
      const cell = target.closest(
        ".md-table-widget th[contenteditable], .md-table-widget td[contenteditable]",
      );
      if (!cell) return false;
      const wrap = cell.closest(".md-table-widget") as HTMLElement | null;
      if (!wrap) return false;
      syncTableFromDom(wrap, view);
      return false;
    },
    paste(event, view) {
      const target = event.target as HTMLElement;
      const cell = target.closest(
        ".md-table-widget th[contenteditable], .md-table-widget td[contenteditable]",
      ) as HTMLElement | null;
      if (!cell) return false;

      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        cell.textContent = (cell.textContent ?? "") + text;
      }

      const wrap = cell.closest(".md-table-widget") as HTMLElement | null;
      if (wrap) scheduleSync(wrap, view);
      return true;
    },
    keydown(event, view) {
      const target = event.target as HTMLElement;
      const cell = target.closest(
        ".md-table-widget th[contenteditable], .md-table-widget td[contenteditable]",
      ) as HTMLElement | null;
      if (!cell) return false;

      const wrap = cell.closest(".md-table-widget") as HTMLElement;
      event.stopPropagation();

      if (event.key === "Tab") {
        event.preventDefault();
        syncTableFromDom(wrap, view);
        focusAdjacentCell(cell, event.shiftKey);
        return true;
      }

      if (event.key === "Backspace") {
        if (isCaretAtStart(cell)) {
          event.preventDefault();
          const cells = getEditableCells(wrap);
          if (cells[0] === cell) {
            exitTableToLineAbove(view, wrap);
          } else {
            syncTableFromDom(wrap, view);
            focusAdjacentCell(cell, true);
          }
          return true;
        }
        return true;
      }

      if (event.key === "Delete") {
        if (isCaretAtEnd(cell)) {
          event.preventDefault();
          const cells = getEditableCells(wrap);
          if (cells[cells.length - 1] === cell) {
            exitTableToLineBelow(view, wrap);
          } else {
            syncTableFromDom(wrap, view);
            focusAdjacentCell(cell, false);
          }
          return true;
        }
        return true;
      }

      if (event.key === "ArrowUp") {
        const cells = getEditableCells(wrap);
        const col = cells.indexOf(cell);
        if (col < 0) return true;
        const rowLen = wrap.querySelectorAll("thead tr th").length || cells.length;
        const prevIdx = col - rowLen;
        if (prevIdx >= 0) {
          event.preventDefault();
          cells[prevIdx].focus();
          placeCaret(cells[prevIdx], false);
        } else {
          event.preventDefault();
          exitTableToLineAbove(view, wrap);
        }
        return true;
      }

      if (event.key === "ArrowDown") {
        const cells = getEditableCells(wrap);
        const col = cells.indexOf(cell);
        if (col < 0) return true;
        const rowLen = wrap.querySelectorAll("thead tr th").length || 1;
        const nextIdx = col + rowLen;
        if (nextIdx < cells.length) {
          event.preventDefault();
          cells[nextIdx].focus();
          placeCaret(cells[nextIdx], false);
        } else {
          event.preventDefault();
          exitTableToLineBelow(view, wrap);
        }
        return true;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        return true;
      }

      return true;
    },
  });
}

/** 从预览装饰集中提取表格原子范围 */
export function tableAtomicRanges(
  deco: import("@codemirror/view").DecorationSet,
): import("@codemirror/view").DecorationSet {
  const ranges: Range<Decoration>[] = [];
  deco.between(0, Number.MAX_SAFE_INTEGER, (from, to, value) => {
    if (value.spec.widget instanceof TableWidget) {
      ranges.push(Decoration.mark({ atomic: true }).range(from, to));
    }
  });
  return Decoration.set(ranges, true);
}

function cellAlignStyle(align: TableAlign): string {
  return align;
}

function appendEditableRow(
  tr: HTMLTableRowElement,
  cells: string[],
  aligns: TableAlign[],
  tag: "th" | "td",
) {
  cells.forEach((cell, i) => {
    const el = document.createElement(tag);
    el.contentEditable = "true";
    el.spellcheck = false;
    el.dataset.col = String(i);
    el.textContent = cell;
    el.style.textAlign = cellAlignStyle(aligns[i] ?? "left");
    tr.appendChild(el);
  });
}

function attachToolbarEvents(wrap: HTMLElement) {
  wrap.addEventListener("mousedown", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".md-table-toolbar button[data-action], .md-table-toolbar-menu button[data-action]",
    );
    if (!btn || !wrap.contains(btn)) return;

    event.preventDefault();
    event.stopPropagation();

    const view = EditorView.findFromDOM(wrap);
    if (!view) return;

    const action = btn.dataset.action;
    if (!action) return;

    wrap.classList.add("md-table-widget--focused");

    if (action === "menu-toggle") {
      const menu = wrap.querySelector(".md-table-toolbar-menu");
      const willOpen = !menu?.classList.contains("is-open");
      closeAllTableMenus();
      if (willOpen) menu?.classList.add("is-open");
    } else {
      handleToolbarAction(wrap, view, action);
      closeAllTableMenus();
    }
  });
}

function refreshToolbarI18n(toolbar: HTMLElement) {
  const locale = getLocale();
  const menuBtn = toolbar.querySelector<HTMLElement>('[data-action="menu-toggle"]');
  if (menuBtn) menuBtn.title = t(locale, "table.toolbar.rows");

  toolbar.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as Parameters<typeof t>[1];
    if (!key) return;
    if (el.dataset.i18nTitle === "true") {
      el.title = t(locale, key);
    } else {
      el.textContent = t(locale, key);
    }
  });

  const deleteBtn = toolbar.querySelector<HTMLElement>('[data-action="delete"]');
  if (deleteBtn) deleteBtn.title = t(locale, "table.toolbar.delete");
}

function createToolbar(): HTMLElement {
  const locale = getLocale();
  const bar = document.createElement("div");
  bar.className = "md-table-toolbar";
  bar.setAttribute("contenteditable", "false");

  const dropdown = document.createElement("div");
  dropdown.className = "md-table-toolbar-dropdown";

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "md-table-toolbar-btn";
  menuBtn.dataset.action = "menu-toggle";
  menuBtn.title = t(locale, "table.toolbar.rows");
  menuBtn.innerHTML =
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M2 4h12v1.5H2V4zm0 3.25h12v1.5H2V7.25zm0 3.25h12V12H2v-1.5z"/></svg>';

  const menu = document.createElement("div");
  menu.className = "md-table-toolbar-menu";
  const menuItems: Array<{ action: string; key: Parameters<typeof t>[1] }> = [
    { action: "row-below", key: "table.toolbar.insertRowBelow" },
    { action: "row-above", key: "table.toolbar.insertRowAbove" },
    { action: "row-delete", key: "table.toolbar.deleteRow" },
    { action: "col-left", key: "table.toolbar.insertColLeft" },
    { action: "col-right", key: "table.toolbar.insertColRight" },
    { action: "col-delete", key: "table.toolbar.deleteCol" },
  ];
  for (const item of menuItems) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = item.action;
    btn.dataset.i18n = item.key;
    btn.textContent = t(locale, item.key);
    if (item.action === "row-delete" || item.action === "col-delete") {
      btn.classList.add("md-table-toolbar-menu-danger");
    }
    menu.appendChild(btn);
  }

  dropdown.appendChild(menuBtn);
  dropdown.appendChild(menu);
  bar.appendChild(dropdown);

  const alignGroup = document.createElement("div");
  alignGroup.className = "md-table-toolbar-group";
  const alignItems: Array<{ action: string; key: Parameters<typeof t>[1]; icon: string }> = [
    {
      action: "align-left",
      key: "table.toolbar.alignLeft",
      icon: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 3h12v1.5H2V3zm0 3.5h8v1.5H2V6.5zm0 3.5h12v1.5H2V10zm0 3.5h8v1.5H2v-1.5z"/></svg>',
    },
    {
      action: "align-center",
      key: "table.toolbar.alignCenter",
      icon: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 3h12v1.5H2V3zm2 3.5h8v1.5H4V6.5zm-2 3.5h12v1.5H2V10zm2 3.5h8v1.5H4v-1.5z"/></svg>',
    },
    {
      action: "align-right",
      key: "table.toolbar.alignRight",
      icon: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 3h12v1.5H2V3zm4 3.5h8v1.5H6V6.5zm-4 3.5h12v1.5H2V10zm4 3.5h8v1.5H6v-1.5z"/></svg>',
    },
  ];
  for (const item of alignItems) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "md-table-toolbar-btn";
    btn.dataset.action = item.action;
    btn.dataset.i18n = item.key;
    btn.dataset.i18nTitle = "true";
    btn.title = t(locale, item.key);
    btn.innerHTML = item.icon;
    alignGroup.appendChild(btn);
  }
  bar.appendChild(alignGroup);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "md-table-toolbar-btn md-table-toolbar-delete";
  deleteBtn.dataset.action = "delete";
  deleteBtn.title = t(locale, "table.toolbar.delete");
  deleteBtn.innerHTML =
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M5 2V1h6v1h4v1.5H1V2h4zm1 4h1.5v7H6V6zm3 0H10.5v7H9V6zM3.5 6H5v9.5c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5V6h1.5v9.5c0 1.7-1.3 3-3 3h-3c-1.7 0-3-1.3-3-3V6z"/></svg>';
  bar.appendChild(deleteBtn);

  const slot = document.createElement("div");
  slot.className = "md-table-toolbar-slot";
  slot.appendChild(bar);
  return slot;
}

function restorePendingFocusOnWrap(wrap: HTMLElement, tableFrom: number) {
  const pending = pendingFocusByTable.get(tableFrom);
  if (!pending) return;
  pendingFocusByTable.delete(tableFrom);
  requestAnimationFrame(() => focusCellOnWrap(wrap, pending.row, pending.col));
}

export class TableWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly header: string[],
    readonly rows: string[][],
    readonly aligns: TableAlign[] = [],
  ) {
    super();
  }

  eq(other: TableWidget) {
    return (
      other.header.join("\0") === this.header.join("\0") &&
      other.rows.map((r) => r.join("\0")).join("\n") ===
        this.rows.map((r) => r.join("\0")).join("\n") &&
      other.aligns.join() === this.aligns.join()
    );
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-table-widget";
    wrap.dataset.tableFrom = String(this.from);
    wrap.dataset.tableTo = String(this.to);
    bindBlockClickEdit(wrap, this.from, this.to, {
      shouldHandle: (event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".md-table-toolbar")) return false;
        if (target.closest("th[contenteditable], td[contenteditable]")) return false;
        return true;
      },
    });
    writeAligns(wrap, this.aligns);

    wrap.appendChild(createToolbar());

    const body = document.createElement("div");
    body.className = "md-table-body";

    const table = document.createElement("table");
    const aligns = [...this.aligns];
    const cols = Math.max(this.header.length, ...this.rows.map((r) => r.length), aligns.length, 1);
    while (aligns.length < cols) aligns.push("left");

    if (this.header.length) {
      const thead = document.createElement("thead");
      const headerTr = document.createElement("tr");
      appendEditableRow(headerTr, this.header, aligns, "th");
      thead.appendChild(headerTr);
      table.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    for (const row of this.rows) {
      const tr = document.createElement("tr");
      appendEditableRow(tr, row, aligns, "td");
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.appendChild(table);
    wrap.appendChild(body);

    wrap.addEventListener("focusin", () => {
      wrap.classList.add("md-table-widget--focused");
    });
    wrap.addEventListener("focusout", () => {
      requestAnimationFrame(() => {
        if (!wrap.contains(document.activeElement)) {
          wrap.classList.remove("md-table-widget--focused");
          closeAllTableMenus();
        }
      });
    });

    attachToolbarEvents(wrap);

    restorePendingFocusOnWrap(wrap, this.from);

    return wrap;
  }

  updateDOM(dom: HTMLElement) {
    dom.dataset.tableFrom = String(this.from);
    dom.dataset.tableTo = String(this.to);
    writeAligns(dom, this.aligns);

    const toolbar = dom.querySelector(".md-table-toolbar");
    if (toolbar) refreshToolbarI18n(toolbar as HTMLElement);

    const focused =
      dom.classList.contains("md-table-widget--focused") ||
      dom.contains(document.activeElement);
    if (focused) dom.classList.add("md-table-widget--focused");

    const ths = dom.querySelectorAll<HTMLElement>("thead th");
    const trs = dom.querySelectorAll<HTMLElement>("tbody tr");
    const aligns = [...this.aligns];
    const cols = Math.max(this.header.length, ...this.rows.map((r) => r.length), aligns.length, 1);
    while (aligns.length < cols) aligns.push("left");

    const structureMismatch =
      ths.length !== this.header.length ||
      trs.length !== this.rows.length ||
      this.rows.some((row, ri) => trs[ri]?.querySelectorAll("td").length !== row.length);
    if (structureMismatch) return false;

    const activeEl = document.activeElement;
    const isEditing = activeEl && dom.contains(activeEl);

    if (this.header.length) {
      this.header.forEach((text, i) => {
        const th = ths[i];
        if (!th || th === activeEl) return;
        if (!isEditing || !th.contains(activeEl!)) {
          th.textContent = text;
          th.style.textAlign = cellAlignStyle(aligns[i] ?? "left");
        }
      });
    }

    this.rows.forEach((row, ri) => {
      const tr = trs[ri];
      if (!tr) return;
      const tds = tr.querySelectorAll<HTMLElement>("td");
      row.forEach((text, ci) => {
        const td = tds[ci];
        if (!td || td === activeEl) return;
        if (!isEditing || !td.contains(activeEl!)) {
          td.textContent = text;
          td.style.textAlign = cellAlignStyle(aligns[ci] ?? "left");
        }
      });
    });

    return true;
  }

  ignoreEvent(event: Event) {
    if (event.target instanceof Element && event.target.closest(".md-table-toolbar")) {
      return false;
    }
    return true;
  }
}
