import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createEditor, type EditorMode } from "../editor";

export interface EditorRef {
  scrollToLine: (line: number) => void;
}

interface Props {
  value: string;
  mode: EditorMode;
  filePath: string | null;
  typewriter: boolean;
  onChange: (doc: string) => void;
  onModeChange: (m: EditorMode) => void;
}

const Editor = forwardRef<EditorRef, Props>(function Editor(
  { value, mode, filePath, typewriter, onChange, onModeChange },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ReturnType<typeof createEditor> | null>(null);
  const onChangeRef = useRef(onChange);
  const onModeRef = useRef(onModeChange);
  onChangeRef.current = onChange;
  onModeRef.current = onModeChange;

  useImperativeHandle(ref, () => ({
    scrollToLine: (line) => handleRef.current?.scrollToLine(line),
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = createEditor(host, value, {
      mode,
      filePath,
      typewriter,
      onChange: (d) => onChangeRef.current(d),
      onModeChange: (m) => onModeRef.current(m),
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
    handleRef.current?.setMode(mode);
  }, [mode]);

  // 外部内容变更（如重新加载文件）时同步到编辑器
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const cur = handle.view.state.doc.toString();
    if (cur !== value) {
      handle.view.dispatch({
        changes: { from: 0, to: cur.length, insert: value },
      });
    }
  }, [value]);

  return <div className="editor-host" ref={hostRef} />;
});

export default Editor;
