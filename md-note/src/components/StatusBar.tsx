import type { EditorMode } from "../editor";

interface Props {
  mode: EditorMode;
  stats: { words: number; chars: number; lines: number; readMin: number };
  path: string | null;
  focusMode: boolean;
  typewriterMode: boolean;
}

export default function StatusBar({ mode, stats, path, focusMode, typewriterMode }: Props) {
  const flags = [
    focusMode ? "专注" : null,
    typewriterMode ? "打字机" : null,
  ].filter(Boolean).join(" · ");

  return (
    <footer className="statusbar">
      <span className="status-item">{mode === "preview" ? "预览" : "源码"}</span>
      {flags && (
        <>
          <span className="status-sep" />
          <span className="status-item">{flags}</span>
        </>
      )}
      <span className="status-sep" />
      <span className="status-item">{stats.words} 字</span>
      <span className="status-item">{stats.lines} 行</span>
      <span className="status-item">约 {stats.readMin} 分钟</span>
      <span className="status-spacer" />
      <span className="status-item status-path" title={path ?? ""}>{path ?? "未保存"}</span>
    </footer>
  );
}
