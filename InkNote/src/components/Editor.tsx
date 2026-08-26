import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Text } from "@codemirror/state";
import { createEditor, type EditorAction, type EditorMode } from "../editor";
import { applyCustomCssToHost, removeCustomCssFromHost } from "../lib/customTheme";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import { modShortcut, redoShortcut } from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import "katex/dist/katex.min.css";

export interface EditorRef {
  scrollToLine: (line: number) => void;
  runAction: (action: EditorAction) => void;
  insertTable: (rows: number, cols: number) => void;
  refreshPreview: () => void;
  resetContent: (content: string) => void;
  getSelectedText: () => string;
}

interface Props {
  locale: Locale;
  value: string;
  mode: EditorMode;
  filePath: string | null;
  typewriter: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  spellCheck: boolean;
  readOnly: boolean;
  onChange: (doc: string) => void;
  onModeChange: (m: EditorMode) => void;
  onCursorLine?: (line: number) => void;
  onOpenMarkdown?: (content: string, path?: string) => void;
  onViewportRange?: (from: number, to: number) => void;
}

const Editor = forwardRef<EditorRef, Props>(function Editor(
  {
    locale,
    value,
    mode,
    filePath,
    typewriter,
    lineNumbers,
    wordWrap,
    tabSize,
    spellCheck,
    readOnly,
    onChange,
    onModeChange,
    onCursorLine,
    onOpenMarkdown,
    onViewportRange,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ReturnType<typeof createEditor> | null>(null);
  const onChangeRef = useRef(onChange);
  const onModeRef = useRef(onModeChange);
  const onCursorLineRef = useRef(onCursorLine);
  const onOpenMarkdownRef = useRef(onOpenMarkdown);
  const onViewportRangeRef = useRef(onViewportRange);
  const lastEmittedRef = useRef(value);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null);

  onChangeRef.current = onChange;
  onModeRef.current = onModeChange;
  onCursorLineRef.current = onCursorLine;
  onOpenMarkdownRef.current = onOpenMarkdown;
  onViewportRangeRef.current = onViewportRange;

  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);
  const showLineNumbers = lineNumbers && mode === "source";

  const run = (action: EditorAction) => {
    handleRef.current?.runAction(action);
    setCtxMenu(null);
  };

  const copyCurrentSelection = () => {
    const selectedText = ctxMenu?.selectedText ?? "";
    if (selectedText) {
      void navigator.clipboard.writeText(selectedText);
      setCtxMenu(null);
      return;
    }
    run("copy");
  };

  const ctxItems: ContextMenuItem[] = [
    { label: tr("menu.undo"), shortcut: modShortcut("Z"), accelerator: "Mod+z", disabled: readOnly, onClick: () => run("undo") },
    { label: tr("menu.redo"), shortcut: redoShortcut(), accelerator: "Mod+Shift+z", disabled: readOnly, onClick: () => run("redo") },
    { separator: true, label: "" },
    { label: tr("menu.cut"), shortcut: modShortcut("X"), accelerator: "Mod+x", disabled: readOnly, onClick: () => run("cut") },
    { label: tr("menu.copy"), shortcut: modShortcut("C"), accelerator: "Mod+c", onClick: copyCurrentSelection },
    { label: tr("menu.paste"), shortcut: modShortcut("V"), accelerator: "Mod+v", disabled: readOnly, onClick: () => run("paste") },
    { label: tr("menu.copyHtml"), onClick: () => run("copyHtml") },
    { separator: true, label: "" },
    { label: tr("menu.find"), shortcut: modShortcut("F"), onClick: () => run("find") },
    { label: tr("menu.selectAll"), shortcut: modShortcut("A"), onClick: () => run("selectAll") },
  ];

  useImperativeHandle(ref, () => ({
    scrollToLine: (line) => handleRef.current?.scrollToLine(line),
    runAction: (action) => {
      handleRef.current?.runAction(action);
    },
    insertTable: (rows, cols) => {
      handleRef.current?.insertTable(rows, cols);
    },
    refreshPreview: () => handleRef.current?.refreshPreview(),
    resetContent: (content) => {
      const handle = handleRef.current;
      if (!handle) return;
      const view = handle.view;
      const nextDoc = Text.of(content.split(/\r\n?|\n/));
      const { anchor, head } = view.state.selection.main;
      lastEmittedRef.current = content;
      if (readOnly) handle.setReadOnly(false);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextDoc },
        selection: {
          anchor: Math.min(anchor, nextDoc.length),
          head: Math.min(head, nextDoc.length),
        },
      });
      if (readOnly) handle.setReadOnly(true);
    },
    getSelectedText: () => {
      const domSelection = window.getSelection();
      if (domSelection?.toString() && hostRef.current?.contains(domSelection.anchorNode)) {
        return domSelection.toString();
      }
      const view = handleRef.current?.view;
      if (!view) return "";
      const { from, to } = view.state.selection.main;
      return from === to ? "" : view.state.sliceDoc(from, to);
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    applyCustomCssToHost(host);
    const onCssChange = () => applyCustomCssToHost(host);
    window.addEventListener("mdnote-custom-css-changed", onCssChange);
    return () => {
      window.removeEventListener("mdnote-custom-css-changed", onCssChange);
      removeCustomCssFromHost(host);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      const selection = window.getSelection();
      const selectedText = selection?.anchorNode && host.contains(selection.anchorNode)
        ? selection.toString()
        : "";
      setCtxMenu({ x: e.clientX, y: e.clientY, selectedText });
    };
    host.addEventListener("contextmenu", onCtx);
    return () => host.removeEventListener("contextmenu", onCtx);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = createEditor(host, value, {
      mode,
      filePath,
      typewriter,
      lineNumbers: showLineNumbers,
      wordWrap,
      tabSize,
      spellCheck,
      readOnly,
      onChange: (d) => {
        lastEmittedRef.current = d;
        onChangeRef.current(d);
      },
      onModeChange: (m) => onModeRef.current(m),
      onCursorLine: (line) => onCursorLineRef.current?.(line),
      onOpenMarkdown: (content, path) => onOpenMarkdownRef.current?.(content, path),
      onViewportRange: (from, to) => onViewportRangeRef.current?.(from, to),
    });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setTypewriter(typewriter);
  }, [typewriter]);

  useEffect(() => {
    handleRef.current?.setLineNumbers(showLineNumbers);
  }, [showLineNumbers]);

  useEffect(() => {
    handleRef.current?.setWordWrap(wordWrap);
  }, [wordWrap]);

  useEffect(() => {
    handleRef.current?.setTabSize(tabSize);
  }, [tabSize]);

  useEffect(() => {
    handleRef.current?.setSpellCheck(spellCheck);
  }, [spellCheck]);

  useEffect(() => {
    handleRef.current?.setReadOnly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    handleRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    handleRef.current?.setFilePath(filePath);
  }, [filePath]);

  useEffect(() => {
    handleRef.current?.refreshPreview();
  }, [locale]);

  useEffect(() => {
    const refresh = () => handleRef.current?.refreshPreview();
    window.addEventListener("mdnote-visual-theme-changed", refresh);
    return () => window.removeEventListener("mdnote-visual-theme-changed", refresh);
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    // 回灌的是编辑器自己刚发出的内容时直接跳过，省一次整篇 toString
    if (value === lastEmittedRef.current) return;
    const view = handle.view;
    const cur = view.state.doc.toString();
    if (cur === value) {
      lastEmittedRef.current = value;
      return;
    }
    const { anchor, head } = view.state.selection.main;
    // CodeMirror 会把 CRLF/CR 统一成内部换行符。使用原字符串 length 会让
    // 搜索跳转到 CRLF 文档时的选区落到新文档末尾之外。
    const nextDoc = Text.of(value.split(/\r\n?|\n/));
    const newLen = nextDoc.length;
    lastEmittedRef.current = value;
    if (readOnly) handle.setReadOnly(false);
    view.dispatch({
      changes: { from: 0, to: cur.length, insert: nextDoc },
      selection: {
        anchor: Math.min(anchor, newLen),
        head: Math.min(head, newLen),
      },
    });
    if (readOnly) handle.setReadOnly(true);
  }, [value, readOnly]);

  return (
    <>
      <div
        className={`editor-host editor-host--${mode}${showLineNumbers ? " editor-host--line-numbers" : ""}${readOnly ? " editor-host--readonly" : ""}`}
        ref={hostRef}
        onBeforeInputCapture={(event) => {
          if (readOnly) event.preventDefault();
        }}
        onPasteCapture={(event) => {
          if (readOnly) event.preventDefault();
        }}
        onDropCapture={(event) => {
          if (readOnly) event.preventDefault();
        }}
      />
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
});

export default Editor;
