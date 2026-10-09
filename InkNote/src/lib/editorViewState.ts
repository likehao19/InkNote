/** Serializable reading position; editor instances and undo history stay in memory. */
export interface EditorViewState {
  anchor: number;
  head: number;
  scrollAnchor: number;
  scrollOffset: number;
  scrollLeft: number;
}

const readers = new Map<string, () => EditorViewState>();

export function registerEditorViewState(id: string, read: () => EditorViewState) {
  readers.set(id, read);
  return () => { if (readers.get(id) === read) readers.delete(id); };
}

export function readEditorViewState(id: string): EditorViewState | undefined {
  return readers.get(id)?.();
}

export function validEditorViewState(value: unknown): value is EditorViewState {
  if (!value || typeof value !== "object") return false;
  const state = value as EditorViewState;
  return [state.anchor, state.head, state.scrollAnchor].every((n) => Number.isSafeInteger(n) && n >= 0)
    && Number.isFinite(state.scrollOffset) && state.scrollOffset >= 0
    && Number.isFinite(state.scrollLeft) && state.scrollLeft >= 0;
}
