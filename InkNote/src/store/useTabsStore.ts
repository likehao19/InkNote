import { create } from "zustand";
import type { EditorMode } from "../editor";
import { getDefaultEditorMode } from "../lib/preferences";
import {
  copyTextEncoding,
  UTF8_TEXT_ENCODING,
  type TextEncoding,
} from "../lib/textEncoding";

export interface TabDoc {
  id: string;
  path: string | null;
  content: string;
  diskContent: string;
  dirty: boolean;
  mode: EditorMode;
  encoding: TextEncoding;
  revision: number;
  externalDocument: boolean;
  documentEditable: boolean;
  sampleDocument: boolean;
  welcomeDismissed: boolean;
}

type DocumentOptions = Pick<TabDoc, "externalDocument" | "documentEditable" | "sampleDocument" | "welcomeDismissed">;

export function sameDocumentPath(a: string, b: string): boolean {
  const normalize = (path: string) => {
    const value = path.replace(/\\/g, "/");
    return /^[a-z]:\//i.test(value) || value.startsWith("//") ? value.toLowerCase() : value;
  };
  return normalize(a) === normalize(b);
}

interface DocState {
  tabs: TabDoc[];
  activeId: string;
  focusMode: boolean;
  typewriterMode: boolean;
  newTab: (content?: string) => string;
  openTab: (path: string, content: string, encoding?: TextEncoding) => string;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  setDocumentOptions: (id: string, options: Partial<DocumentOptions>) => void;
  restoreTab: (snap: {
    path: string | null;
    content: string;
    diskContent: string;
    dirty: boolean;
    mode: EditorMode;
    encoding: TextEncoding;
  }) => string;
  updateContent: (id: string, content: string) => void;
  setMode: (id: string, mode: EditorMode) => void;
  /** 保存完成：只更新磁盘基线，不动正在编辑的内容 */
  markSaved: (id: string, path?: string, savedContent?: string, encoding?: TextEncoding) => void;
  /** 用磁盘内容整体替换（外部修改 / 手动重新加载） */
  loadFromDisk: (id: string, path: string, content: string, encoding?: TextEncoding) => void;
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
    encoding: copyTextEncoding(UTF8_TEXT_ENCODING),
    revision: 0,
    externalDocument: false,
    documentEditable: true,
    sampleDocument: false,
    welcomeDismissed: false,
  };
}

/** 新文件可复用尚未输入的欢迎页，其余文档保留独立状态。 */
function appendTab(tabs: TabDoc[], tab: TabDoc): TabDoc[] {
  return [...tabs.filter((item) => item.path || item.content || item.welcomeDismissed), tab];
}

export const useTabsStore = create<DocState>((set, get) => ({
  tabs: [emptyTab()],
  activeId: "",
  focusMode: false,
  typewriterMode: false,

  newTab: (content = "") => {
    const tab = emptyTab();
    tab.content = content;
    tab.dirty = Boolean(content);
    tab.welcomeDismissed = true;
    set((state) => ({ tabs: appendTab(state.tabs, tab), activeId: tab.id }));
    return tab.id;
  },

  openTab: (path, content, encoding = UTF8_TEXT_ENCODING) => {
    const existing = get().tabs.find((tab) => tab.path && sameDocumentPath(tab.path, path));
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    set((state) => {
      const tab: TabDoc = {
        ...emptyTab(),
        path,
        content,
        diskContent: content,
        dirty: false,
        mode: getDefaultEditorMode(),
        encoding: copyTextEncoding(encoding),
        welcomeDismissed: true,
      };
      return { tabs: appendTab(state.tabs, tab), activeId: tab.id };
    });
    return get().activeId;
  },

  closeTab: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index < 0) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      if (!tabs.length) tabs.push(emptyTab());
      return { tabs, activeId: state.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : state.activeId };
    });
  },

  activateTab: (id) => {
    if (get().tabs.some((tab) => tab.id === id)) set({ activeId: id });
  },

  setDocumentOptions: (id, options) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === id ? { ...tab, ...options } : tab),
  })),

  restoreTab: (snap) => {
    const tab: TabDoc = {
      ...emptyTab(),
      path: snap.path,
      content: snap.content,
      diskContent: snap.diskContent,
      dirty: snap.dirty,
      mode: snap.mode,
      encoding: copyTextEncoding(snap.encoding),
      welcomeDismissed: true,
    };
    const existing = tab.path && get().tabs.find((item) => item.path && sameDocumentPath(item.path, tab.path!));
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    set((state) => ({ tabs: appendTab(state.tabs, tab), activeId: tab.id }));
    return tab.id;
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
  markSaved: (id, path, savedContent, encoding) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const disk = savedContent ?? t.content;
        return {
          ...t,
          path: path ?? t.path,
          diskContent: disk,
          dirty: t.content !== disk,
          encoding: encoding ? copyTextEncoding(encoding) : t.encoding,
        };
      }),
    }));
  },

  /** 用磁盘内容整体替换当前文档 */
  loadFromDisk: (id, path, content, encoding) => {
    set((s) => {
      let activeId = s.activeId;
      const tabs = s.tabs.map((t) => {
        if (t.id !== id) return t;
        const next = {
          ...t,
          revision: t.revision + 1,
          path,
          content,
          diskContent: content,
          dirty: false,
          encoding: encoding ? copyTextEncoding(encoding) : t.encoding,
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
