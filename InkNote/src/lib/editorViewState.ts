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

export function mapReloadedViewState(state: EditorViewState, before: string, after: string): EditorViewState {
  // CodeMirror positions count each line break as one character.
  before = before.replace(/\r\n?/g, "\n");
  after = after.replace(/\r\n?/g, "\n");
  let start = 0;
  const sharedLength = Math.min(before.length, after.length);
  while (start < sharedLength && before[start] === after[start]) start++;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  const map = (position: number) => {
    position = Math.min(position, before.length);
    if (position < start) return position;
    if (position >= oldEnd) return position + newEnd - oldEnd;
    return Math.min(position, newEnd);
  };
  return { ...state, anchor: map(state.anchor), head: map(state.head), scrollAnchor: map(state.scrollAnchor) };
}

export function validEditorViewState(value: unknown): value is EditorViewState {
  if (!value || typeof value !== "object") return false;
  const state = value as EditorViewState;
  return [state.anchor, state.head, state.scrollAnchor].every((n) => Number.isSafeInteger(n) && n >= 0)
    && Number.isFinite(state.scrollOffset) && state.scrollOffset >= 0
    && Number.isFinite(state.scrollLeft) && state.scrollLeft >= 0;
}
