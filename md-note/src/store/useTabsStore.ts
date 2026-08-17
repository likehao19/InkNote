import { create } from "zustand";
import type { EditorMode } from "../editor";

export interface TabDoc {
  id: string;
  path: string | null;
  content: string;
  diskContent: string;
  dirty: boolean;
  mode: EditorMode;
}

interface TabsState {
  tabs: TabDoc[];
  activeId: string;
  focusMode: boolean;
  typewriterMode: boolean;
  newTab: () => string;
  openTab: (path: string, content: string) => string;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  setMode: (id: string, mode: EditorMode) => void;
  markSaved: (id: string, path?: string, content?: string) => void;
  getActive: () => TabDoc | undefined;
  toggleFocusMode: () => void;
  toggleTypewriterMode: () => void;
}

let tabCounter = 0;
function newId() {
  return `tab-${++tabCounter}-${Date.now()}`;
}

function emptyTab(): TabDoc {
  const id = newId();
  return { id, path: null, content: "", diskContent: "", dirty: false, mode: "preview" };
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [emptyTab()],
  activeId: "",
  focusMode: false,
  typewriterMode: false,

  newTab: () => {
    const tab = emptyTab();
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
    return tab.id;
  },

  openTab: (path, content) => {
    const s = get();
    const existing = s.tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    const emptyIdx = s.tabs.findIndex((t) => !t.path && !t.dirty && !t.content);
    const tab: TabDoc = {
      id: emptyIdx >= 0 ? s.tabs[emptyIdx].id : newId(),
      path,
      content,
      diskContent: content,
      dirty: false,
      mode: "preview",
    };
    if (emptyIdx >= 0) {
      set({
        tabs: s.tabs.map((t, i) => (i === emptyIdx ? tab : t)),
        activeId: tab.id,
      });
    } else {
      set({ tabs: [...s.tabs, tab], activeId: tab.id });
    }
    return tab.id;
  },

  closeTab: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      if (idx < 0) return s;
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (tabs.length === 0) {
        const t = emptyTab();
        return { tabs: [t], activeId: t.id };
      }
      let activeId = s.activeId;
      if (activeId === id) {
        activeId = tabs[Math.min(idx, tabs.length - 1)].id;
      }
      return { tabs, activeId };
    });
  },

  setActive: (id) => set({ activeId: id }),

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

// 初始化 activeId
const init = useTabsStore.getState();
if (!init.activeId && init.tabs[0]) {
  useTabsStore.setState({ activeId: init.tabs[0].id });
}
