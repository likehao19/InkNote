import { EditorView } from "@codemirror/view";

/**
 * 在预览块级 Widget DOM 上标记源码区间。
 *
 * 注意：CodeMirror 在 `eq()` 判定相等时会直接复用旧 DOM（既不调用 `toDOM`
 * 也不调用 `updateDOM`），所以这里写入的绝对位置会在文档上方发生编辑后过期。
 * 真正取位置请用 `currentBlockRange()`，它以 `posAtDOM` 为准，只把长度当缓存。
 */
export function stampBlockRange(el: HTMLElement, from: number, to: number) {
  el.dataset.blockFrom = String(from);
  el.dataset.blockTo = String(to);
  el.dataset.blockLen = String(to - from);
}

/** 以 DOM 当前挂载位置反查源码区间（对复用的 DOM 依然正确） */
export function currentBlockRange(
  view: EditorView,
  el: HTMLElement,
): { from: number; to: number } | null {
  // 已经脱离编辑器的节点必须直接放弃：posAtDOM 对游离节点会退化成
  // 0 或 doc.length，拿去 dispatch 会覆盖掉文档头尾
  if (!el.isConnected || !view.dom.contains(el)) return null;

  const len = Number(el.dataset.blockLen);
  if (!Number.isFinite(len) || len < 0) return null;

  let from: number;
  try {
    from = view.posAtDOM(el);
  } catch {
    return null;
  }
  if (!Number.isFinite(from)) return null;

  const docLen = view.state.doc.length;
  const start = Math.min(Math.max(from, 0), docLen);
  return { from: start, to: Math.min(start + len, docLen) };
}

/**
 * 把组件外层上下留白的点击放到相邻可见正文行。
 *
 * CodeMirror 若直接处理块级替换节点的边界，会画出与整个组件同高的光标，
 * 回车也可能被原子区间吞掉。预览中的 Markdown 空行已经完全折叠，所以这里
 * 必须越过空行，退到上一段末尾 / 下一段开头，不能再次把隐藏空行展开。
 */
export function bindBlockBoundaryCursor(el: HTMLElement, visualBody: HTMLElement) {
  el.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || event.target !== el) return;

    const bodyRect = visualBody.getBoundingClientRect();
    const before = event.clientY < bodyRect.top;
    const after = event.clientY > bodyRect.bottom;
    if (!before && !after) return;

    const view = EditorView.findFromDOM(el);
    const range = view && currentBlockRange(view, el);
    if (!view || !range) return;

    const doc = view.state.doc;
    let pos = before ? range.from : range.to;
    if (before) {
      for (let number = doc.lineAt(range.from).number - 1; number >= 1; number--) {
        const line = doc.line(number);
        if (line.text.trim()) {
          pos = line.to;
          break;
        }
      }
    } else {
      for (let number = doc.lineAt(range.to).number + 1; number <= doc.lines; number++) {
        const line = doc.line(number);
        if (line.text.trim()) {
          pos = line.from;
          break;
        }
      }
    }

    event.preventDefault();
    // 同一根节点上还可能绑定“点击选中组件”；这里必须连同后续监听器一起
    // 截断，否则刚放到空行的编辑器光标会立刻又被组件焦点覆盖。
    event.stopImmediatePropagation();
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  });
}

/** 将块级 Widget 上的点击映射到源码字符位置（含横向估算） */
export function mapClickToBlockPos(
  view: EditorView,
  from: number,
  to: number,
  clientX: number,
  clientY: number,
  el: HTMLElement,
): number {
  const direct = view.posAtCoords({ x: clientX, y: clientY });
  if (direct != null && direct >= from && direct < to) return direct;

  const rect = el.getBoundingClientRect();
  const blockLen = Math.max(1, to - from);
  if (rect.height <= 0 && rect.width <= 0) return from;

  const yRatio = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(rect.height, 1)));
  const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1)));
  const estimated = from + Math.floor(blockLen * (yRatio * 0.82 + xRatio * 0.18));
  return Math.min(Math.max(estimated, from), Math.max(from, to - 1));
}

const BOUND = "data-blockClickBound";

export type BlockClickOptions = {
  shouldHandle?: (event: MouseEvent) => boolean;
};

/** 在 Widget 根节点绑定左键点击进入源码（不经过编辑器全局 mousedown） */
export function bindBlockClickEdit(
  el: HTMLElement,
  from: number,
  to: number,
  options?: BlockClickOptions,
) {
  stampBlockRange(el, from, to);

  if (el.hasAttribute(BOUND)) return;
  el.setAttribute(BOUND, "1");

  el.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (options?.shouldHandle && !options.shouldHandle(event)) return;

    const view = EditorView.findFromDOM(el);
    if (!view) return;

    const range = currentBlockRange(view, el);
    if (!range) return;

    const sel = view.state.selection.main;
    if (sel.from >= range.from && sel.from < range.to) return;

    event.preventDefault();
    event.stopPropagation();

    const pos = mapClickToBlockPos(
      view,
      range.from,
      range.to,
      event.clientX,
      event.clientY,
      el,
    );
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  });
}
