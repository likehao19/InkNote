import { WidgetType, EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { EditorSelection, EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { undo, redo } from "@codemirror/commands";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import { askConfirm } from "../../lib/confirmBridge";
import { getLocale, t } from "../../lib/i18n";
import { getConfirmDelete } from "../../lib/preferences";
import { bindBlockBoundaryCursor, currentBlockRange, stampBlockRange } from "./blockRange";
import { clickedOnBlockPadding } from "./editableSource";

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

  // 手写表格常有残缺行，必须补齐成矩形，否则单元格索引全乱
  const colCount = Math.max(header.length, aligns.length, ...rows.map((r) => r.length), 1);
  while (header.length < colCount) header.push("");
  while (aligns.length < colCount) aligns.push("left");
  for (const row of rows) while (row.length < colCount) row.push("");

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

/** 从某个位置向上找包含它的表格：O(树深) 而不是遍历整棵树 */
export function enclosingTable(state: EditorState, pos: number): TableRange | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 0);
  for (; node; node = node.parent) {
    if (node.name === "Table") return { from: node.from, to: node.to };
  }
  return null;
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
  const range = enclosingTable(state, pos);
  if (!range) return null;

  const line = state.doc.lineAt(pos);
  if (isDelimiterLine(line.text)) return null;

  const row = tableRowAtLine(state, range.from, line.number);
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

export async function mutateTableInView(view: EditorView, action: TableEditAction): Promise<boolean> {
  if (action === "delete") {
    const ctx = getTableAtCursor(view.state, view.state.selection.main.head);
    if (!ctx) return false;
    if (getConfirmDelete()) {
      if (!(await askConfirm(t(getLocale(), "confirm.deleteTable")))) return false;
    }
    let end = ctx.range.to;
    if (end < view.state.doc.length && view.state.doc.sliceString(end, end + 1) === "\n") {
      end += 1;
    }
    view.dispatch({
      changes: { from: ctx.range.from, to: end, insert: "" },
      selection: { anchor: ctx.range.from },
      scrollIntoView: true,
      userEvent: "delete.table",
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
    userEvent: "input.table",
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

/* ------------------------------------------------------------------ *
 * 单元格内容：DOM 展示渲染后的行内 Markdown，源码保存在 dataset.raw
 * ------------------------------------------------------------------ */

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => HTML_ESCAPE[c]);
}

/** 单元格里的行内 Markdown 渲染（粗体/斜体/删除线/行内代码/高亮/链接） */
export function renderInlineMarkdown(src: string): string {
  const parts = escapeHtml(src).split(/(`[^`]+`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${part.slice(1, -1)}</code>`;
      return part
        .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, '<a class="md-table-link">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_]+)__/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(/(^|[^_\w])_([^_]+)_/g, "$1<em>$2</em>")
        .replace(/~~([^~]+)~~/g, "<del>$1</del>")
        .replace(/==([^=]+)==/g, "<mark>$1</mark>");
    })
    .join("");
}

/** 写入单元格：聚焦中的单元格保持源码，其余显示渲染结果 */
function setCellRaw(cell: HTMLElement, raw: string) {
  cell.dataset.raw = raw;
  if (document.activeElement === cell) {
    if (cell.textContent !== raw) cell.textContent = raw;
  } else {
    cell.innerHTML = renderInlineMarkdown(raw);
  }
}

/** 读取单元格源码（聚焦中的以实时文本为准） */
function cellRawText(cell: HTMLElement): string {
  if (document.activeElement === cell) return cell.textContent ?? "";
  return cell.dataset.raw ?? cell.textContent ?? "";
}

function showCellSource(cell: HTMLElement) {
  const raw = cell.dataset.raw ?? cell.textContent ?? "";
  cell.dataset.raw = raw;
  if (cell.textContent !== raw) cell.textContent = raw;
}

/**
 * 切回渲染态。
 *
 * 一律以 dataset.raw 为准：失焦时 updateDOM 可能已经把单元格渲染过一遍，
 * 这时再去读 textContent 拿到的是渲染结果（`粗` 而不是 `**粗**`），会把源码写坏。
 */
function showCellRendered(cell: HTMLElement) {
  const raw = cell.dataset.raw ?? cell.textContent ?? "";
  cell.dataset.raw = raw;
  cell.innerHTML = renderInlineMarkdown(raw);
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
  wrap.querySelectorAll<HTMLElement>("thead th").forEach((th) => {
    header.push(cellRawText(th));
  });

  const rows: string[][] = [];
  wrap.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => {
    const row: string[] = [];
    tr.querySelectorAll<HTMLElement>("td").forEach((td) => {
      row.push(cellRawText(td));
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
  showCellSource(next);
  next.focus();
  placeCaret(next, !backward);
}

/** 按行列取单元格：不做等宽假设，残缺表格也能定位 */
function cellAt(wrap: HTMLElement, row: number, col: number): HTMLElement | null {
  if (row === 0) {
    return wrap.querySelectorAll<HTMLElement>("thead th")[col] ?? null;
  }
  const tr = wrap.querySelectorAll<HTMLElement>("tbody tr")[row - 1];
  if (!tr) return null;
  return tr.querySelectorAll<HTMLElement>("td")[col] ?? null;
}

/** 单元格在表格里的行列位置（表头为第 0 行） */
function cellPosition(cell: HTMLElement): CellPosition | null {
  const tr = cell.closest("tr");
  if (!tr) return null;
  const col = Array.from(tr.children).indexOf(cell);
  if (col < 0) return null;
  if (cell.tagName === "TH") return { row: 0, col };
  const tbody = tr.parentElement;
  const row = 1 + (tbody ? Array.from(tbody.children).indexOf(tr) : 0);
  return { row, col };
}

function clearCellSelection(wrap: HTMLElement) {
  wrap.querySelectorAll(".md-table-cell-selected").forEach((el) => {
    el.classList.remove("md-table-cell-selected");
  });
}

/** 框选一个矩形区域；只选中一个格时不算多选 */
function selectCellRange(wrap: HTMLElement, a: HTMLElement, b: HTMLElement) {
  clearCellSelection(wrap);
  const pa = cellPosition(a);
  const pb = cellPosition(b);
  if (!pa || !pb) return;
  if (pa.row === pb.row && pa.col === pb.col) return;

  const r0 = Math.min(pa.row, pb.row);
  const r1 = Math.max(pa.row, pb.row);
  const c0 = Math.min(pa.col, pb.col);
  const c1 = Math.max(pa.col, pb.col);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      cellAt(wrap, r, c)?.classList.add("md-table-cell-selected");
    }
  }
  // 跨格的原生文本选区在 contenteditable 之间会很难看，直接清掉
  window.getSelection()?.removeAllRanges();
}

function selectedCells(wrap: HTMLElement): HTMLElement[] {
  return Array.from(wrap.querySelectorAll<HTMLElement>(".md-table-cell-selected"));
}

/**
 * 当前操作涉及的列。
 *
 * Markdown 的对齐是「整列」属性（分隔行的 `:---:`），无法只让某几个格居中，
 * 所以框选多列后对齐会作用到这几列 —— 这是 Markdown 格式本身的限制。
 */
function targetColumns(wrap: HTMLElement): number[] {
  const cells = selectedCells(wrap);
  const cols = new Set<number>();
  for (const cell of cells) {
    const pos = cellPosition(cell);
    if (pos) cols.add(pos.col);
  }
  if (cols.size) return [...cols].sort((a, b) => a - b);
  const count = Math.max(
    wrap.querySelectorAll("thead th").length,
    ...Array.from(wrap.querySelectorAll("tbody tr"), (row) => row.querySelectorAll("td").length),
    1,
  );
  return Array.from({ length: count }, (_, index) => index);
}

function rowCount(wrap: HTMLElement): number {
  const head = wrap.querySelectorAll("thead tr").length;
  return head + wrap.querySelectorAll("tbody tr").length;
}

function focusCellOnWrap(wrap: HTMLElement, row: number, col: number, atEnd = false) {
  const cell = cellAt(wrap, row, col);
  if (!cell) return;
  wrap.classList.add("md-table-widget--focused");
  showCellSource(cell);
  cell.focus();
  placeCaret(cell, atEnd);
}

const pendingFocusByTable = new Map<number, CellPosition>();

/** 用 DOM 实际挂载位置反查 wrap（dataset 里的绝对位置会因 DOM 复用而过期） */
function findTableWrap(view: EditorView, from: number): HTMLElement | null {
  const wraps = view.dom.querySelectorAll<HTMLElement>(".md-table-widget");
  for (const wrap of wraps) {
    const range = currentBlockRange(view, wrap);
    if (range && range.from === from) return wrap;
  }
  return null;
}

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
    const wrap = findTableWrap(view, table.from);
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
    const wrap = findTableWrap(view, table.from);
    if (!wrap) return;
    if (last) {
      const rows = rowCount(wrap);
      const lastRow = Math.max(0, rows - 1);
      const cells = lastRow === 0
        ? wrap.querySelectorAll("thead th").length
        : (wrap.querySelectorAll<HTMLElement>("tbody tr")[lastRow - 1]?.querySelectorAll("td").length ?? 1);
      focusCellOnWrap(wrap, lastRow, Math.max(0, cells - 1), true);
    } else {
      focusCellOnWrap(wrap, 0, 0, false);
    }
  });
  return true;
}

function snapOutsideTable(
  state: EditorState,
  pos: number,
  prevFrom: number,
  prevTo: number,
): number {
  const table = enclosingTable(state, pos);
  if (!table || pos <= table.from || pos >= table.to) return pos;

  // 光标本来就在这张表的源码里（用户正在改源码）时不打扰
  if (prevFrom < table.to && prevTo > table.from) return pos;

  const mid = (table.from + table.to) / 2;
  return pos >= mid ? positionAfterTable(state, table.to) : table.from;
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
    const range = currentBlockRange(view, wrap);
    if (range) pendingFocusByTable.set(range.from, focusAt);
  }
  syncTableFromDom(wrap, view, data);
}

function syncTableFromDom(wrap: HTMLElement, view: EditorView, data?: TableData) {
  const range = currentBlockRange(view, wrap);
  if (!range) return;

  const tableData = data ?? readTableFromDom(wrap);
  const insert = serializeTable(tableData.header, tableData.rows, tableData.aligns);
  const current = view.state.doc.sliceString(range.from, range.to);
  if (current === insert) return;

  tableSyncing = true;
  try {
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      userEvent: "input.table",
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

function flushSync(wrap: HTMLElement, view: EditorView) {
  const existing = syncFrames.get(wrap);
  if (existing) {
    cancelAnimationFrame(existing);
    syncFrames.delete(wrap);
  }
  syncTableFromDom(wrap, view);
}

function exitTableToLineAbove(view: EditorView, wrap: HTMLElement) {
  const range = currentBlockRange(view, wrap);
  flushSync(wrap, view);
  if (!range) return;
  const line = view.state.doc.lineAt(Math.min(range.from, view.state.doc.length));
  let pos = line.from;
  if (line.number > 1) {
    pos = view.state.doc.line(line.number - 1).to;
  }
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
}

function exitTableToLineBelow(view: EditorView, wrap: HTMLElement) {
  flushSync(wrap, view);
  const range = currentBlockRange(view, wrap);
  if (!range) return;
  const pos = positionAfterTable(view.state, range.to);
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
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

/** 对齐：未框选时作用于整表；框选后作用于所选单元格覆盖的列。 */
function applyAlign(wrap: HTMLElement, view: EditorView, align: TableAlign) {
  const cols = targetColumns(wrap);
  const data = readTableFromDom(wrap);
  for (const col of cols) {
    while (data.aligns.length <= col) data.aligns.push("left");
    data.aligns[col] = align;
  }
  applyTableData(wrap, view, data);
}

/** 清空框选区域里的内容 */
function clearSelectedCells(wrap: HTMLElement, view: EditorView): boolean {
  const cells = selectedCells(wrap);
  if (!cells.length) return false;
  for (const cell of cells) {
    cell.dataset.raw = "";
    cell.innerHTML = "";
  }
  clearCellSelection(wrap);
  flushSync(wrap, view);
  return true;
}

function deleteTable(wrap: HTMLElement, view: EditorView) {
  void (async () => {
    if (getConfirmDelete()) {
      if (!(await askConfirm(t(getLocale(), "confirm.deleteTable")))) return;
    }
    const range = currentBlockRange(view, wrap);
    if (!range) return;
    let end = range.to;
    if (end < view.state.doc.length && view.state.doc.sliceString(end, end + 1) === "\n") {
      end += 1;
    }
    view.dispatch({
      changes: { from: range.from, to: end, insert: "" },
      selection: { anchor: range.from },
      userEvent: "delete.table",
    });
    view.focus();
  })();
}

function handleToolbarAction(wrap: HTMLElement, view: EditorView, action: string) {
  switch (action) {
    case "row-below":
      applyTableEdit(wrap, view, "row-below");
      break;
    case "row-above":
      applyTableEdit(wrap, view, "row-above");
      break;
    case "row-delete":
      applyTableEdit(wrap, view, "row-delete");
      break;
    case "col-left":
      applyTableEdit(wrap, view, "col-left");
      break;
    case "col-right":
      applyTableEdit(wrap, view, "col-right");
      break;
    case "col-delete":
      applyTableEdit(wrap, view, "col-delete");
      break;
    case "align-left":
      applyAlign(wrap, view, "left");
      break;
    case "align-center":
      applyAlign(wrap, view, "center");
      break;
    case "align-right":
      applyAlign(wrap, view, "right");
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
    // 只处理纯移动光标：带文档变更时坐标系已变，且用户此刻必然在源码态
    if (!tr.selection || tr.docChanged || isEditingTableCell()) return tr;

    const prev = tr.startState.selection.main;
    let changed = false;
    const ranges = tr.selection.ranges.map((range) => {
      const anchor = snapOutsideTable(tr.startState, range.anchor, prev.from, prev.to);
      const head = snapOutsideTable(tr.startState, range.head, prev.from, prev.to);
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
    setCellRaw(el, cell);
    el.style.textAlign = cellAlignStyle(aligns[i] ?? "left");
    tr.appendChild(el);
  });
}

/**
 * 单元格交互。
 *
 * 必须直接挂在 widget DOM 上：`ignoreEvent()` 返回 true 时 CodeMirror 会在
 * `eventBelongsToEditor` 里直接丢弃事件，`EditorView.domEventHandlers` 注册的
 * 处理器根本收不到单元格里的事件。
 */
function attachCellEvents(wrap: HTMLElement) {
  let composing = false;
  let dragAnchor: HTMLElement | null = null;
  let dragging = false;

  const viewOf = () => EditorView.findFromDOM(wrap);
  const cellOf = (event: Event) =>
    (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "th[contenteditable], td[contenteditable]",
    ) ?? null;

  wrap.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const cell = cellOf(event);
    if (!cell) return;
    wrap.classList.add("md-table-widget--focused");
    // 不做整列高亮：点一下就把一整列刷上底色，看着像「整列被选中」
    // 在浏览器放置光标之前换成源码文本，否则改写 textContent 会把光标打掉
    showCellSource(cell);
    clearCellSelection(wrap);
    dragAnchor = cell;
    dragging = true;
  });

  // 按住拖过多个单元格 = 框选
  wrap.addEventListener("mouseover", (event) => {
    if (!dragging || !dragAnchor) return;
    const cell = cellOf(event);
    if (!cell || cell === dragAnchor) return;
    selectCellRange(wrap, dragAnchor, cell);
  });

  const endDrag = () => {
    dragging = false;
    dragAnchor = null;
  };
  wrap.addEventListener("mouseup", endDrag);
  wrap.addEventListener("mouseleave", endDrag);

  wrap.addEventListener("focusin", (event) => {
    wrap.classList.add("md-table-widget--focused");
    const cell = cellOf(event);
    if (cell) showCellSource(cell);
  });

  wrap.addEventListener("focusout", (event) => {
    const cell = cellOf(event);
    const view = viewOf();
    if (cell && view) {
      // 失焦时单元格显示的还是源码，先落到 dataset.raw 再同步
      cell.dataset.raw = cell.textContent ?? "";
      flushSync(wrap, view);
      showCellRendered(cell);
    }
    requestAnimationFrame(() => {
      if (!wrap.contains(document.activeElement)) {
        wrap.classList.remove("md-table-widget--focused");
        closeAllTableMenus();
      }
    });
  });

  wrap.addEventListener("compositionstart", () => {
    composing = true;
  });

  wrap.addEventListener("compositionend", (event) => {
    composing = false;
    const cell = cellOf(event);
    const view = viewOf();
    if (!cell || !view) return;
    cell.dataset.raw = cell.textContent ?? "";
    scheduleSync(wrap, view);
  });

  wrap.addEventListener("input", (event) => {
    if (tableSyncing) return;
    // 输入法组合期间同步会打断候选词
    if (composing) return;
    const cell = cellOf(event);
    const view = viewOf();
    if (!cell || !view) return;
    cell.dataset.raw = cell.textContent ?? "";
    scheduleSync(wrap, view);
  });

  wrap.addEventListener("paste", (event) => {
    const cell = cellOf(event);
    const view = viewOf();
    if (!cell || !view) return;

    event.preventDefault();
    const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\r?\n/g, " ");
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && cell.contains(sel.getRangeAt(0).startContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      cell.textContent = (cell.textContent ?? "") + text;
    }
    cell.dataset.raw = cell.textContent ?? "";
    scheduleSync(wrap, view);
  });

  wrap.addEventListener("keydown", (event) => {
    const cell = cellOf(event);
    if (!cell) return;
    const view = viewOf();
    if (!view) return;

    const mod = event.ctrlKey || event.metaKey;

    if (mod) {
      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        event.stopPropagation();
        clearCellSelection(wrap);
        getEditableCells(wrap).forEach((item) => item.classList.add("md-table-cell-selected"));
        window.getSelection()?.removeAllRanges();
        return;
      }
      // 浏览器原生富文本命令会往单元格里塞 <b>/<i>/<u>
      if (key === "b" || key === "i" || key === "u") {
        event.preventDefault();
        return;
      }
      // 原生 contenteditable 撤销与文档历史不同步，交给 CodeMirror
      if (key === "z" || key === "y") {
        event.preventDefault();
        flushSync(wrap, view);
        cell.blur();
        view.focus();
        if (key === "y" || event.shiftKey) redo(view);
        else undo(view);
        return;
      }
      // 其余（Ctrl+S 等）放行冒泡到 window，让全局快捷键生效
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clearCellSelection(wrap);
      exitTableToLineBelow(view, wrap);
      return;
    }

    // 框选状态下的删除：清空选中区域的内容
    if ((event.key === "Backspace" || event.key === "Delete") && selectedCells(wrap).length) {
      event.preventDefault();
      clearSelectedCells(wrap, view);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      flushSync(wrap, view);
      focusAdjacentCell(cell, event.shiftKey);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const info = getFocusedCellInfo(wrap);
      if (!info) return;
      const rows = rowCount(wrap);
      if (info.row >= rows - 1) {
        applyTableEdit(wrap, view, "row-below");
      } else {
        focusCellOnWrap(wrap, info.row + 1, info.col);
      }
      return;
    }

    if (event.key === "Backspace" && isCaretAtStart(cell)) {
      event.preventDefault();
      const cells = getEditableCells(wrap);
      if (cells[0] === cell) {
        exitTableToLineAbove(view, wrap);
      } else {
        flushSync(wrap, view);
        focusAdjacentCell(cell, true);
      }
      return;
    }

    if (event.key === "Delete" && isCaretAtEnd(cell)) {
      event.preventDefault();
      const cells = getEditableCells(wrap);
      if (cells[cells.length - 1] === cell) {
        exitTableToLineBelow(view, wrap);
      } else {
        flushSync(wrap, view);
        focusAdjacentCell(cell, false);
      }
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const info = getFocusedCellInfo(wrap);
      if (!info) return;
      const next = event.key === "ArrowUp" ? info.row - 1 : info.row + 1;
      event.preventDefault();
      if (next < 0) {
        exitTableToLineAbove(view, wrap);
      } else if (next >= rowCount(wrap)) {
        exitTableToLineBelow(view, wrap);
      } else {
        flushSync(wrap, view);
        focusCellOnWrap(wrap, next, info.col);
      }
      return;
    }

    // 其它按键交给浏览器原生编辑，不 preventDefault、不阻断冒泡
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

  /**
   * 比较内容与源码长度。位置不参与比较（否则上方一有编辑整表就重建），
   * 长度参与比较则保证复用 DOM 时缓存的 blockLen 依然有效。
   */
  eq(other: TableWidget) {
    return (
      other.to - other.from === this.to - this.from &&
      other.header.join("\0") === this.header.join("\0") &&
      other.rows.map((r) => r.join("\0")).join("\n") ===
        this.rows.map((r) => r.join("\0")).join("\n") &&
      other.aligns.join() === this.aligns.join()
    );
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "md-table-widget";
    // 不再绑定「点击进入源码」：点表格空白处应该定位光标，不该翻出 Markdown
    stampBlockRange(wrap, this.from, this.to);
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
    bindBlockBoundaryCursor(wrap, body);

    attachToolbarEvents(wrap);
    attachCellEvents(wrap);

    restorePendingFocusOnWrap(wrap, this.from);

    return wrap;
  }

  updateDOM(dom: HTMLElement) {
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

    stampBlockRange(dom, this.from, this.to);
    writeAligns(dom, this.aligns);

    const toolbar = dom.querySelector(".md-table-toolbar");
    if (toolbar) refreshToolbarI18n(toolbar as HTMLElement);

    if (dom.contains(document.activeElement)) {
      dom.classList.add("md-table-widget--focused");
    }

    const activeEl = document.activeElement;

    this.header.forEach((text, i) => {
      const th = ths[i];
      // 正在输入的单元格不能重写内容，否则光标会被打掉
      if (!th || th === activeEl) return;
      setCellRaw(th, text);
      th.style.textAlign = cellAlignStyle(aligns[i] ?? "left");
    });

    this.rows.forEach((row, ri) => {
      const tr = trs[ri];
      if (!tr) return;
      const tds = tr.querySelectorAll<HTMLElement>("td");
      row.forEach((text, ci) => {
        const td = tds[ci];
        if (!td || td === activeEl) return;
        setCellRaw(td, text);
        td.style.textAlign = cellAlignStyle(aligns[ci] ?? "left");
      });
    });

    restorePendingFocusOnWrap(dom, this.from);
    return true;
  }

  /**
   * 单元格里的所有事件都由 attachCellEvents 直接处理，CodeMirror 一律不插手：
   * 返回 false 会让 CM 对按键调用 preventDefault，原生输入会被吃掉。
   * 例外是点在外层留白上——交还给编辑器用于定位光标。
   */
  ignoreEvent(event: Event) {
    return !clickedOnBlockPadding(event, "md-table-widget");
  }
}
