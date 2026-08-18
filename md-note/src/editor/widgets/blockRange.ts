import { EditorView } from "@codemirror/view";

/** 在预览块级 Widget DOM 上标记源码区间 */
export function stampBlockRange(el: HTMLElement, from: number, to: number) {
  el.dataset.blockFrom = String(from);
  el.dataset.blockTo = String(to);
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

    const sel = view.state.selection.main;
    if (sel.from >= from && sel.from < to) return;

    event.preventDefault();
    event.stopPropagation();

    const pos = mapClickToBlockPos(
      view,
      from,
      to,
      event.clientX,
      event.clientY,
      el,
    );
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  });
}
