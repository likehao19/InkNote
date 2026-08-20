import type { EditorMode } from "../editor";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

interface Props {
  locale: Locale;
  mode: EditorMode;
  stats: { words: number; chars: number; lines: number; readMin: number };
  path: string | null;
  dirty: boolean;
  cursorLine: number;
  focusMode: boolean;
  typewriterMode: boolean;
  onCopyPath?: () => void;
}

export default function StatusBar({
  locale,
  mode,
  stats,
  path,
  dirty,
  cursorLine,
  focusMode,
  typewriterMode,
  onCopyPath,
}: Props) {
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) =>
    t(locale, key, vars);

  const flags = [
    dirty ? tr("status.modified") : null,
    focusMode ? tr("status.focus") : null,
    typewriterMode ? tr("status.typewriter") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pathLabel = path ?? tr("status.unsaved");
  const pathTitle = path
    ? `${path}\n${tr("status.clickCopy")}`
    : tr("status.unsaved");

  return (
    <footer className="statusbar">
      <span className="status-item">
        {mode === "preview" ? tr("status.preview") : tr("status.source")}
      </span>
      {flags && (
        <>
          <span className="status-sep" />
          <span className="status-item">{flags}</span>
        </>
      )}
      <span className="status-sep" />
      <span className="status-item">{tr("status.line", { n: cursorLine })}</span>
      <span className="status-item">{tr("status.words", { n: stats.words })}</span>
      <span className="status-item">{tr("status.chars", { n: stats.chars })}</span>
      <span className="status-item">{tr("status.lines", { n: stats.lines })}</span>
      <span className="status-item">{tr("status.readMin", { n: stats.readMin })}</span>
      <span className="status-spacer" />
      <button
        type="button"
        className="status-item status-path-btn"
        title={pathTitle}
        disabled={!path}
        onClick={() => path && onCopyPath?.()}
      >
        {pathLabel}
      </button>
    </footer>
  );
}
