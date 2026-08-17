import { EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/** 光标是否在 GFM 表格内 */
export function cursorInTable(state: EditorState, pos: number): boolean {
  let found = false;
  syntaxTree(state).iterate({
    from: pos,
    to: pos,
    enter(node) {
      if (node.name === "Table") {
        found = true;
        return false;
      }
    },
  });
  return found;
}

/** 解析表格行中的单元格边界（源码偏移） */
function tableCellBounds(lineText: string, lineFrom: number): number[] {
  const bounds: number[] = [];
  if (!lineText.includes("|")) return bounds;

  let i = 0;
  if (lineText[i] === "|") {
    bounds.push(lineFrom + i);
    i++;
  }
  while (i < lineText.length) {
    const next = lineText.indexOf("|", i);
    if (next < 0) break;
    bounds.push(lineFrom + next);
    i = next + 1;
  }
  return bounds;
}

function isDelimiterRow(text: string): boolean {
  return /^\s*\|?[\s:-]+\|[\s|:-]+\|?\s*$/.test(text);
}

/** Tab：在表格单元格间跳转；行末跳到下一行首格 */
export function tableTab(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  if (!cursorInTable(state, pos)) return false;

  const line = state.doc.lineAt(pos);
  if (isDelimiterRow(line.text)) return false;

  const bounds = tableCellBounds(line.text, line.from);
  if (bounds.length < 2) return false;

  // 单元格内部可定位点：分隔符之间
  const cells: { from: number; to: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i] + 1;
    const to = bounds[i + 1];
    if (to - from > 0) cells.push({ from, to });
  }
  if (!cells.length) return false;

  const inCell = cells.findIndex((c) => pos >= c.from && pos <= c.to);
  const cellIdx = inCell >= 0 ? inCell : cells.findIndex((c) => pos < c.from);

  let nextPos: number;
  if (cellIdx >= 0 && cellIdx < cells.length - 1) {
    nextPos = cells[cellIdx + 1].from;
  } else {
    // 下一行
    if (line.number >= state.doc.lines) return false;
    const nextLine = state.doc.line(line.number + 1);
    if (isDelimiterRow(nextLine.text)) {
      if (line.number + 1 >= state.doc.lines) return false;
      const dataLine = state.doc.line(line.number + 2);
      const nb = tableCellBounds(dataLine.text, dataLine.from);
      if (nb.length < 2) return false;
      nextPos = nb[0] + 1;
    } else {
      const nb = tableCellBounds(nextLine.text, nextLine.from);
      if (nb.length < 2) return false;
      nextPos = nb[0] + 1;
    }
  }

  view.dispatch({ selection: { anchor: nextPos }, scrollIntoView: true });
  return true;
}

/** Shift+Tab：反向跳转 */
export function tableShiftTab(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  if (!cursorInTable(state, pos)) return false;

  const line = state.doc.lineAt(pos);
  if (isDelimiterRow(line.text)) return false;

  const bounds = tableCellBounds(line.text, line.from);
  if (bounds.length < 2) return false;

  const cells: { from: number; to: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i] + 1;
    const to = bounds[i + 1];
    if (to - from > 0) cells.push({ from, to });
  }
  if (!cells.length) return false;

  const inCell = cells.findIndex((c) => pos >= c.from && pos <= c.to);
  const cellIdx = inCell >= 0 ? inCell : cells.length - 1;

  let nextPos: number;
  if (cellIdx > 0) {
    nextPos = cells[cellIdx - 1].from;
  } else if (line.number > 1) {
    let prevNum = line.number - 1;
    let prevLine = state.doc.line(prevNum);
    if (isDelimiterRow(prevLine.text) && prevNum > 1) {
      prevLine = state.doc.line(prevNum - 1);
    }
    const pb = tableCellBounds(prevLine.text, prevLine.from);
    if (pb.length < 2) return false;
    nextPos = pb[pb.length - 2] + 1;
  } else {
    return false;
  }

  view.dispatch({ selection: { anchor: nextPos }, scrollIntoView: true });
  return true;
}
