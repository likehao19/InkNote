import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createEditor, type EditorAction, type EditorMode } from "../editor";

export interface EditorRef {
  scrollToLine: (line: number) => void;
  runAction: (action: EditorAction) => void;
  insertTable: (rows: number, cols: number) => void;
}

interface Props {
  value: string;
  mode: EditorMode;
  filePath: string | null;
  typewriter: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  spellCheck: boolean;
  onChange: (doc: string) => void;
  onModeChange: (m: EditorMode) => void;
  onCursorLine?: (line: number) => void;
}

const Editor = forwardRef<EditorRef, Props>(function Editor(
  {
    value,
    mode,
    filePath,
    typewriter,
    lineNumbers,
    wordWrap,
    tabSize,
    spellCheck,
    onChange,
    onModeChange,
    onCursorLine,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ReturnType<typeof createEditor> | null>(null);
  const onChangeRef = useRef(onChange);
  const onModeRef = useRef(onModeChange);
  const onCursorLineRef = useRef(onCursorLine);
  onChangeRef.current = onChange;
  onModeRef.current = onModeChange;
  onCursorLineRef.current = onCursorLine;

  const showLineNumbers = lineNumbers && mode === "source";

  useImperativeHandle(ref, () => ({
    scrollToLine: (line) => handleRef.current?.scrollToLine(line),
    runAction: (action) => {
      handleRef.current?.runAction(action);
    },
    insertTable: (rows, cols) => {
      handleRef.current?.insertTable(rows, cols);
    },
  }));

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
      onChange: (d) => onChangeRef.current(d),
      onModeChange: (m) => onModeRef.current(m),
      onCursorLine: (line) => onCursorLineRef.current?.(line),
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
    handleRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    handleRef.current?.setFilePath(filePath);
  }, [filePath]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const view = handle.view;
    const cur = view.state.doc.toString();
    if (cur === value) return;
    const { anchor, head } = view.state.selection.main;
    const newLen = value.length;
    view.dispatch({
      changes: { from: 0, to: cur.length, insert: value },
      selection: {
        anchor: Math.min(anchor, newLen),
        head: Math.min(head, newLen),
      },
    });
  }, [value]);

  return (
    <div
      className={showLineNumbers ? "editor-host editor-host--line-numbers" : "editor-host"}
      ref={hostRef}
    />
  );
});

export default Editor;
