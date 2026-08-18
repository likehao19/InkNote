import { create } from "zustand";
import type { EditorMode } from "../editor";
import { getDefaultEditorMode } from "../lib/preferences";

export interface TabDoc {
  id: string;
  path: string | null;
  content: string;
  diskContent: string;
  dirty: boolean;
  mode: EditorMode;
}

interface DocState {
  tabs: TabDoc[];
  activeId: string;
  focusMode: boolean;
  typewriterMode: boolean;
  newTab: () => string;
  openTab: (path: string, content: string) => string;
  closeTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  setMode: (id: string, mode: EditorMode) => void;
  markSaved: (id: string, path?: string, content?: string) => void;
  getActive: () => TabDoc | undefined;
  toggleFocusMode: () => void;
  toggleTypewriterMode: () => void;
}

let tabCounter = 0;
function newId() {
  return `doc-${++tabCounter}-${Date.now()}`;
}

function emptyTab(): TabDoc {
  const id = newId();
  return {
    id,
    path: null,
    content: "",
    diskContent: "",
    dirty: false,
    mode: getDefaultEditorMode(),
  };
}

/** 单文档编辑：始终只保留一个活动文档槽位 */
export const useTabsStore = create<DocState>((set, get) => ({
  tabs: [emptyTab()],
  activeId: "",
  focusMode: false,
  typewriterMode: false,

  newTab: () => {
    const tab = emptyTab();
    set({ tabs: [tab], activeId: tab.id });
    return tab.id;
  },

  openTab: (path, content) => {
    set((s) => {
      const cur = s.tabs.find((t) => t.id === s.activeId) ?? s.tabs[0] ?? emptyTab();
      const tab: TabDoc = {
        ...cur,
        path,
        content,
        diskContent: content,
        dirty: false,
      };
      return { tabs: [tab], activeId: tab.id };
    });
    return get().activeId;
  },

  closeTab: (_id) => {
    const tab = emptyTab();
    set({ tabs: [tab], activeId: tab.id });
  },

  updateContent: (id, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, dirty: t.diskContent !== content } : t,
      ),
    }));
  },

  setMode: (id, mode) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, mode } : t)),
    }));
  },

  markSaved: (id, path, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const c = content ?? t.content;
        return {
          ...t,
          path: path ?? t.path,
          content: c,
          diskContent: c,
          dirty: false,
        };
      }),
    }));
  },

  getActive: () => {
    const s = get();
    if (!s.activeId && s.tabs.length) return s.tabs[0];
    return s.tabs.find((t) => t.id === s.activeId) ?? s.tabs[0];
  },

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleTypewriterMode: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
}));

const init = useTabsStore.getState();
if (!init.activeId && init.tabs[0]) {
  useTabsStore.setState({ activeId: init.tabs[0].id });
}
