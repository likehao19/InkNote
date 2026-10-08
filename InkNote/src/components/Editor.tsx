import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Text } from "@codemirror/state";
import { createEditor, type EditorAction, type EditorMode } from "../editor";
import { applyCustomCssToHost, removeCustomCssFromHost } from "../lib/customTheme";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import { modShortcut, redoShortcut } from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import { selectedTableText } from "../editor/widgets/table";
import "katex/dist/katex.min.css";

export interface EditorRef {
  previewSearchMatch: (match: { from: number; to: number } | null) => void;
  scrollToLine: (line: number) => void;
  runAction: (action: EditorAction) => void;
  insertTable: (rows: number, cols: number) => void;
  refreshPreview: () => void;
  resetContent: (content: string) => void;
  getSelectedText: () => string;
  captureAiSelection: (preferredText?: string | null) => AiSelectionSnapshot | null;
  applyAiResult: (snapshot: AiSelectionSnapshot, replacement: string, insertBelow: boolean) => boolean;
}

export interface AiSelectionSnapshot {
  text: string;
  from: number;
  to: number;
  wholeDocument: boolean;
}

interface Props {
  documentId?: string;
  active?: boolean;
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
  aiEnabled?: boolean;
  onAiRequest?: (selection: AiSelectionSnapshot) => void;
  onChange: (doc: string) => void;
  onModeChange: (m: EditorMode) => void;
  onCursorLine?: (line: number) => void;
  onOpenMarkdown?: (content: string, path?: string) => void;
  onViewportRange?: (from: number, to: number) => void;
}

const Editor = forwardRef<EditorRef, Props>(function Editor(
  {
    documentId,
    active = true,
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
    aiEnabled = false,
    onAiRequest,
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
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; selectedText: string | null } | null>(null);

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
    if (ctxMenu?.selectedText !== null && ctxMenu?.selectedText !== undefined) {
      void writeClipboardText(selectedText).catch(() => {});
      setCtxMenu(null);
      return;
    }
    run("copy");
  };

  const captureAiSelection = (preferredText?: string | null): AiSelectionSnapshot | null => {
    const view = handleRef.current?.view;
    if (!view) return null;
    const documentText = view.state.doc.toString();
    const { from, to } = view.state.selection.main;
    if (from !== to) {
      return { text: view.state.sliceDoc(from, to), from, to, wholeDocument: false };
    }
    const nativeText = preferredText ?? (() => {
      const selection = window.getSelection();
      return selection?.anchorNode && hostRef.current?.contains(selection.anchorNode)
        ? selection.toString()
        : "";
    })();
    if (nativeText) {
      const matches: number[] = [];
      let offset = documentText.indexOf(nativeText);
      while (offset >= 0) {
        matches.push(offset);
        offset = documentText.indexOf(nativeText, offset + Math.max(1, nativeText.length));
      }
      const nearest = matches.sort((left, right) => (
        Math.abs(left - view.state.selection.main.head) - Math.abs(right - view.state.selection.main.head)
      ))[0];
      if (nearest !== undefined) {
        return { text: nativeText, from: nearest, to: nearest + nativeText.length, wholeDocument: false };
      }
      return null;
    }
    return { text: documentText, from: 0, to: documentText.length, wholeDocument: true };
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
    ...(aiEnabled ? [
      { separator: true, label: "" },
      {
        label: tr("ai.contextAction"),
        onClick: () => {
          const selection = captureAiSelection(ctxMenu?.selectedText);
          setCtxMenu(null);
          if (selection) onAiRequest?.(selection);
        },
      },
    ] satisfies ContextMenuItem[] : []),
  ];

  useImperativeHandle(ref, () => ({
    previewSearchMatch: (match) => handleRef.current?.previewSearchMatch(match),
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
      // 预览切回编辑时通常只是解除只读。相同内容若仍整篇替换，
      // CodeMirror 会重新估算长文档高度并改变当前阅读位置。
      if (view.state.doc.eq(nextDoc)) return;
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
    captureAiSelection,
    applyAiResult: (snapshot, replacement, insertBelow) => {
      const handle = handleRef.current;
      if (!handle || readOnly) return false;
      const view = handle.view;
      if (view.state.sliceDoc(snapshot.from, snapshot.to) !== snapshot.text) return false;
      if (insertBelow) {
        const prefix = snapshot.to > 0 && view.state.sliceDoc(snapshot.to - 1, snapshot.to) !== "\n" ? "\n\n" : "\n";
        view.dispatch({
          changes: { from: snapshot.to, insert: `${prefix}${replacement}` },
          selection: { anchor: snapshot.to + prefix.length + replacement.length },
          scrollIntoView: true,
        });
      } else {
        view.dispatch({
          changes: { from: snapshot.from, to: snapshot.to, insert: replacement },
          selection: { anchor: snapshot.from + replacement.length },
          scrollIntoView: true,
        });
      }
      return true;
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
      const nativeText = selection?.anchorNode && host.contains(selection.anchorNode)
        ? selection.toString()
        : "";
      const selectedText = selectedTableText(e.target) ?? (nativeText || null);
      setCtxMenu({ x: e.clientX, y: e.clientY, selectedText });
    };
    host.addEventListener("contextmenu", onCtx);
    return () => host.removeEventListener("contextmenu", onCtx);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = createEditor(host, value, {
      documentId,
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
    if (!active) return;
    const view = handleRef.current?.view;
    if (!view) return;
    view.requestMeasure();
    view.focus();
    onCursorLineRef.current?.(view.state.doc.lineAt(view.state.selection.main.head).number);
    onViewportRangeRef.current?.(view.state.doc.lineAt(view.viewport.from).number, view.state.doc.lineAt(view.viewport.to).number);
  }, [active]);

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
