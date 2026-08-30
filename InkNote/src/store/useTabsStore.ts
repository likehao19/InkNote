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
  newTab: (content?: string) => string;
  openTab: (path: string, content: string) => string;
  closeTab: (id: string) => void;
  restoreTab: (snap: {
    path: string | null;
    content: string;
    diskContent: string;
    dirty: boolean;
    mode: EditorMode;
  }) => void;
  updateContent: (id: string, content: string) => void;
  setMode: (id: string, mode: EditorMode) => void;
  /** 保存完成：只更新磁盘基线，不动正在编辑的内容 */
  markSaved: (id: string, path?: string, savedContent?: string) => void;
  /** 用磁盘内容整体替换（外部修改 / 手动重新加载） */
  loadFromDisk: (id: string, path: string, content: string) => void;
  /** 仅改路径（重命名），不影响未保存状态 */
  setPath: (id: string, path: string) => void;
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

  newTab: (content = "") => {
    const tab = emptyTab();
    tab.content = content;
    tab.dirty = Boolean(content);
    set({ tabs: [tab], activeId: tab.id });
    return tab.id;
  },

  openTab: (path, content) => {
    set(() => {
      const tab: TabDoc = {
        id: newId(),
        path,
        content,
        diskContent: content,
        dirty: false,
        mode: getDefaultEditorMode(),
      };
      return { tabs: [tab], activeId: tab.id };
    });
    return get().activeId;
  },

  closeTab: (_id) => {
    const tab = emptyTab();
    set({ tabs: [tab], activeId: tab.id });
  },

  restoreTab: (snap) => {
    const tab: TabDoc = {
      id: newId(),
      path: snap.path,
      content: snap.content,
      diskContent: snap.diskContent,
      dirty: snap.dirty,
      mode: snap.mode,
    };
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

  /**
   * 保存完成。
   *
   * 只把磁盘基线推进到刚写出去的内容，**不能**用写盘前的快照覆盖 content ——
   * 否则在 IPC 往返期间敲进去的字会被抹掉。dirty 由当前内容与基线比较得出，
   * 保存期间新输入的内容会继续保持 dirty，等待用户再次保存或退出时写回。
   */
  markSaved: (id, path, savedContent) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const disk = savedContent ?? t.content;
        return {
          ...t,
          path: path ?? t.path,
          diskContent: disk,
          dirty: t.content !== disk,
        };
      }),
    }));
  },

  /** 用磁盘内容整体替换当前文档 */
  loadFromDisk: (id, path, content) => {
    set((s) => {
      let activeId = s.activeId;
      const tabs = s.tabs.map((t) => {
        if (t.id !== id) return t;
        const next = {
          ...t,
          id: newId(),
          path,
          content,
          diskContent: content,
          dirty: false,
        };
        if (activeId === id) activeId = next.id;
        return next;
      });
      return { tabs, activeId };
    });
  },

  setPath: (id, path) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, path } : t)),
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
