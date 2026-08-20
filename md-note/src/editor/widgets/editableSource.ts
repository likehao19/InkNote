import { EditorView } from "@codemirror/view";
import { undo, redo } from "@codemirror/commands";
import { currentBlockRange } from "./blockRange";

/**
 * 块级 Widget 的「就地编辑」基础设施。
 *
 * 设计前提：这些 Widget 的 `ignoreEvent()` 返回 true，CodeMirror 在
 * `eventBelongsToEditor` 阶段就会丢弃里面的事件，所以监听器必须直接挂在
 * Widget DOM 上；同时 CM 也不会对按键 preventDefault，原生输入才能正常工作。
 */

/** 纯文本可编辑：回车插入真正的换行，且屏蔽原生富文本命令 */
export function makePlainTextEditable(el: HTMLElement) {
  try {
    el.contentEditable = "plaintext-only";
  } catch {
    el.contentEditable = "true";
  }
  el.spellcheck = false;
  el.dataset.blockSource = "1";
}

/**
 * 进入组件的源码编辑态。
 *
 * 必须先加 `md-block--editing`：源码区平时是 `display: none`，
 * 对隐藏元素调用 focus() 不会有任何效果。
 */
export function beginSourceEditing(wrap: HTMLElement, source: HTMLElement, atEnd = true) {
  wrap.classList.add("md-block--editing");
  source.focus();
  setCaretOffset(source, atEnd ? sourceText(source).length : 0);
}

/**
 * 鼠标点在组件外层留白（root 自身）上时交还给编辑器，
 * 这样点击块与块之间的空隙是把光标放到相邻正文，而不是被组件吞掉。
 */
export function clickedOnBlockPadding(event: Event, rootClass: string): boolean {
  if (event.type !== "mousedown") return false;
  const target = event.target as HTMLElement | null;
  return !!target?.classList?.contains(rootClass);
}

interface PlainTextRead {
  text: string;
  caret: number | null;
}

/** 走 DOM 取纯文本；顺便把 DOM 光标换算成文本偏移（两者口径必须一致） */
export function readPlainText(
  root: HTMLElement,
  caretNode?: Node | null,
  caretOffset = 0,
): PlainTextRead {
  let text = "";
  let caret: number | null = null;

  const visitChildren = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      if (caret === null && node === caretNode && i === caretOffset) caret = text.length;
      visit(children[i]);
    }
    if (caret === null && node === caretNode && caretOffset >= children.length) {
      caret = text.length;
    }
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? "";
      if (caret === null && node === caretNode) {
        caret = text.length + Math.min(caretOffset, value.length);
      }
      text += value;
      return;
    }
    if (node.nodeName === "BR") {
      if (caret === null && node === caretNode) caret = text.length;
      text += "\n";
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // plaintext-only 下不应出现块级子节点，这里只是兜底
      const block = el.nodeName === "DIV" || el.nodeName === "P";
      if (block && text.length > 0 && !text.endsWith("\n")) text += "\n";
      visitChildren(el);
    }
  };

  visitChildren(root);
  return { text, caret };
}

/** 当前光标在元素内的文本偏移 */
export function caretTextOffset(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  return readPlainText(root, range.startContainer, range.startOffset).caret;
}

/** 把光标放到元素内的第 offset 个字符处 */
export function setCaretOffset(root: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = node.nodeValue?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** 读取编辑区里的源码文本 */
export function sourceText(el: HTMLElement): string {
  return readPlainText(el).text;
}

let blockSyncing = false;

/** Widget 内部改写文档时置位，避免自触发 */
export function isBlockSyncing(): boolean {
  return blockSyncing;
}

function writeBlock(view: EditorView, wrap: HTMLElement, markdown: string) {
  const range = currentBlockRange(view, wrap);
  if (!range) return;
  const current = view.state.doc.sliceString(range.from, range.to);
  if (current === markdown) return;

  blockSyncing = true;
  try {
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: markdown },
      userEvent: "input.block",
    });
  } finally {
    blockSyncing = false;
  }
}

/** 把光标移到块后面的正文位置并交还给编辑器 */
export function exitBlock(view: EditorView, wrap: HTMLElement, before = false) {
  const range = currentBlockRange(view, wrap);
  if (!range) return;
  const doc = view.state.doc;
  let pos: number;
  if (before) {
    const line = doc.lineAt(Math.min(range.from, doc.length));
    pos = line.number > 1 ? doc.line(line.number - 1).to : line.from;
  } else {
    pos = range.to < doc.length && doc.sliceString(range.to, range.to + 1) === "\n"
      ? range.to + 1
      : range.to;
  }
  view.dispatch({ selection: { anchor: Math.min(pos, doc.length) } });
  view.focus();
}

export interface SourceEditingOptions {
  /** 可编辑源码区（可能在 updateDOM 后被替换，所以用取值函数） */
  source: () => HTMLElement | null;
  /** 由源码文本生成这一整块的 Markdown */
  toMarkdown: (text: string) => string;
  /** 每次输入后刷新预览（高亮、KaTeX、Mermaid…） */
  onInput?: (text: string, el: HTMLElement) => void;
  onEditingChange?: (editing: boolean) => void;
  /** Tab 是否插入缩进（代码块要，公式块不要） */
  indentOnTab?: boolean;
}

/**
 * 给块级 Widget 挂上就地编辑：聚焦即编辑、输入即回写、失焦刷新预览。
 * 行为与表格单元格保持一致（Esc 退出、Ctrl+Z 走编辑器历史、Ctrl+S 正常冒泡）。
 */
export function attachSourceEditing(wrap: HTMLElement, opts: SourceEditingOptions) {
  let composing = false;
  let frame = 0;

  const viewOf = () => EditorView.findFromDOM(wrap);
  const inSource = (event: Event) => {
    const el = opts.source();
    const target = event.target as Node | null;
    return el && target && (el === target || el.contains(target)) ? el : null;
  };

  const flush = () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    const el = opts.source();
    const view = viewOf();
    if (!el || !view) return;
    writeBlock(view, wrap, opts.toMarkdown(sourceText(el)));
  };

  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      const el = opts.source();
      const view = viewOf();
      if (!el || !view) return;
      writeBlock(view, wrap, opts.toMarkdown(sourceText(el)));
    });
  };

  wrap.addEventListener("focusin", (event) => {
    if (!inSource(event)) return;
    wrap.classList.add("md-block--editing");
    opts.onEditingChange?.(true);
  });

  wrap.addEventListener("focusout", (event) => {
    if (!inSource(event)) return;
    flush();
    requestAnimationFrame(() => {
      if (wrap.contains(document.activeElement)) return;
      wrap.classList.remove("md-block--editing");
      opts.onEditingChange?.(false);
    });
  });

  wrap.addEventListener("compositionstart", () => {
    composing = true;
  });

  wrap.addEventListener("compositionend", (event) => {
    composing = false;
    const el = inSource(event);
    if (!el) return;
    opts.onInput?.(sourceText(el), el);
    schedule();
  });

  wrap.addEventListener("input", (event) => {
    if (blockSyncing || composing) return;
    const el = inSource(event);
    if (!el) return;
    opts.onInput?.(sourceText(el), el);
    schedule();
  });

  wrap.addEventListener("paste", (event) => {
    const el = inSource(event);
    if (!el) return;
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).startContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(document.createTextNode(text));
    }
    opts.onInput?.(sourceText(el), el);
    schedule();
  });

  wrap.addEventListener("keydown", (event) => {
    const el = inSource(event);
    if (!el) return;
    const view = viewOf();
    if (!view) return;

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i" || key === "u") {
        // 原生富文本命令会往纯文本区里塞标签
        event.preventDefault();
        return;
      }
      if (key === "z" || key === "y") {
        event.preventDefault();
        flush();
        el.blur();
        view.focus();
        if (key === "y" || event.shiftKey) redo(view);
        else undo(view);
        return;
      }
      // Ctrl+S 等交给 window 上的全局快捷键
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      flush();
      exitBlock(view, wrap);
      return;
    }

    // 首尾再按方向键就离开这一块，避免光标困在组件里
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      if (caretTextOffset(el) === 0) {
        event.preventDefault();
        flush();
        exitBlock(view, wrap, true);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      if (caretTextOffset(el) === sourceText(el).length) {
        event.preventDefault();
        flush();
        exitBlock(view, wrap);
      }
      return;
    }

    if (event.key === "Backspace" && !sourceText(el).length) {
      // 内容已清空，再退格就整块删掉
      event.preventDefault();
      const range = currentBlockRange(view, wrap);
      if (!range) return;
      let end = range.to;
      if (end < view.state.doc.length && view.state.doc.sliceString(end, end + 1) === "\n") {
        end += 1;
      }
      view.dispatch({
        changes: { from: range.from, to: end, insert: "" },
        selection: { anchor: range.from },
        userEvent: "delete.block",
      });
      view.focus();
      return;
    }

    if (event.key === "Tab" && opts.indentOnTab !== false) {
      event.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode("  "));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      opts.onInput?.(sourceText(el), el);
      schedule();
    }
  });
}

export interface BlockSelectionOptions {
  /** 双击 / 回车触发的编辑动作（例如打开图片对话框） */
  onEdit?: (view: EditorView, wrap: HTMLElement) => void;
}

/* ------------------------------------------------------------------ *
 * 键盘进入块：块级 Widget 是原子区间，光标会整块跳过，
 * 所以需要在边界上把焦点主动交给块内部的编辑器。
 * ------------------------------------------------------------------ */

function findBlockWrap(
  view: EditorView,
  match: (range: { from: number; to: number }) => boolean,
): HTMLElement | null {
  const wraps = view.dom.querySelectorAll<HTMLElement>("[data-block-len]");
  for (const wrap of Array.from(wraps)) {
    const range = currentBlockRange(view, wrap);
    if (range && match(range)) return wrap;
  }
  return null;
}

function focusInsideBlock(wrap: HTMLElement, atEnd: boolean): boolean {
  // data-block-source="1" 才是主编辑区（代码块的语言标签是 "lang"）
  const source = wrap.querySelector<HTMLElement>('[data-block-source="1"]');
  if (source) {
    beginSourceEditing(wrap, source, atEnd);
    return true;
  }
  const cells = wrap.querySelectorAll<HTMLElement>("th[contenteditable], td[contenteditable]");
  if (cells.length) {
    const cell = atEnd ? cells[cells.length - 1] : cells[0];
    cell.focus();
    return true;
  }
  if (wrap.hasAttribute("tabindex")) {
    wrap.focus();
    return document.activeElement === wrap;
  }
  return false;
}

/** 光标在块前后时，用方向键进入块内部；不适用时返回 false 走默认移动 */
export function enterAdjacentBlock(
  view: EditorView,
  forward: boolean,
  requireLineEdge: boolean,
): boolean {
  const sel = view.state.selection.main;
  if (!sel.empty) return false;

  const doc = view.state.doc;
  const line = doc.lineAt(sel.head);

  if (forward) {
    if (requireLineEdge && sel.head !== line.to) return false;
    const next = line.to + 1;
    if (next > doc.length) return false;
    const wrap = findBlockWrap(view, (r) => r.from === next);
    return wrap ? focusInsideBlock(wrap, false) : false;
  }

  if (requireLineEdge && sel.head !== line.from) return false;
  const prev = line.from - 1;
  if (prev < 0) return false;
  const wrap = findBlockWrap(view, (r) => r.to === prev);
  return wrap ? focusInsideBlock(wrap, true) : false;
}

/**
 * 把焦点交给源码区间起点为 from 的块级组件。
 * 装饰重建 + 语法树解析可能跨帧完成，所以重试几帧。
 */
export function focusBlockStartingAt(view: EditorView, from: number, tries = 4) {
  requestAnimationFrame(() => {
    const wrap = findBlockWrap(view, (r) => r.from === from);
    if (wrap) {
      focusInsideBlock(wrap, false);
      return;
    }
    if (tries > 1) focusBlockStartingAt(view, from, tries - 1);
  });
}

/**
 * 不含文本的块（图片、分割线）：点击选中，Backspace/Delete 整块删除，
 * Esc / 方向键退出。避免点一下就把 Markdown 源码翻出来。
 */
export function attachBlockSelection(wrap: HTMLElement, opts: BlockSelectionOptions = {}) {
  wrap.tabIndex = -1;

  const viewOf = () => EditorView.findFromDOM(wrap);

  wrap.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    wrap.focus();
  });

  wrap.addEventListener("focus", () => wrap.classList.add("md-block--selected"));
  wrap.addEventListener("blur", () => wrap.classList.remove("md-block--selected"));

  wrap.addEventListener("dblclick", (event) => {
    const view = viewOf();
    if (!view || !opts.onEdit) return;
    event.preventDefault();
    opts.onEdit(view, wrap);
  });

  wrap.addEventListener("keydown", (event) => {
    const view = viewOf();
    if (!view) return;

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const range = currentBlockRange(view, wrap);
      if (!range) return;
      let end = range.to;
      if (end < view.state.doc.length && view.state.doc.sliceString(end, end + 1) === "\n") {
        end += 1;
      }
      view.dispatch({
        changes: { from: range.from, to: end, insert: "" },
        selection: { anchor: range.from },
        userEvent: "delete.block",
      });
      view.focus();
      return;
    }

    if (event.key === "Enter" && opts.onEdit) {
      event.preventDefault();
      opts.onEdit(view, wrap);
      return;
    }

    if (event.key === "Escape" || event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      exitBlock(view, wrap);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      exitBlock(view, wrap, true);
    }
  });
}
