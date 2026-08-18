import type { EditorMode } from "../editor";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

interface Props {
  locale: Locale;
  mode: EditorMode;
  stats: { words: number; chars: number; lines: number; readMin: number };
  path: string | null;
  focusMode: boolean;
  typewriterMode: boolean;
}

export default function StatusBar({
  locale,
  mode,
  stats,
  path,
  focusMode,
  typewriterMode,
}: Props) {
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) =>
    t(locale, key, vars);

  const flags = [
    focusMode ? tr("status.focus") : null,
    typewriterMode ? tr("status.typewriter") : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
      <span className="status-item">{tr("status.words", { n: stats.words })}</span>
      <span className="status-item">{tr("status.lines", { n: stats.lines })}</span>
      <span className="status-item">{tr("status.readMin", { n: stats.readMin })}</span>
      <span className="status-spacer" />
      <span className="status-item status-path" title={path ?? ""}>
        {path ?? tr("status.unsaved")}
      </span>
    </footer>
  );
}
