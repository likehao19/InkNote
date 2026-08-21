import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import type { MarkdownTheme } from "../lib/markdownTheme";

interface Props {
  locale: Locale;
  value: MarkdownTheme;
  onChange: (theme: MarkdownTheme) => void;
}

const OPTIONS: MarkdownTheme[] = ["github", "vue", "minimal"];

const LABEL_KEYS: Record<MarkdownTheme, Parameters<typeof t>[1]> = {
  github: "settings.markdownTheme.github",
  vue: "settings.markdownTheme.vue",
  minimal: "settings.markdownTheme.minimal",
};

function DocumentPreview({ theme, mode }: { theme: MarkdownTheme; mode: "light" | "dark" }) {
  return (
    <div className="md-theme-preview-pane" data-md-preview={theme} data-preview-mode={mode}>
      <div className="md-theme-preview-title">Aa</div>
      <div className="md-theme-preview-line md-theme-preview-line-long" />
      <div className="md-theme-preview-quote" />
      <div className="md-theme-preview-table"><i /><i /><i /><i /></div>
      <div className="md-theme-preview-code">const note = true</div>
    </div>
  );
}

export default function MarkdownThemePicker({ locale, value, onChange }: Props) {
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="theme-picker markdown-theme-picker">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "theme-picker-card selected" : "theme-picker-card"}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
        >
          <div className="md-theme-preview" aria-hidden="true">
            <DocumentPreview theme={option} mode="light" />
            <DocumentPreview theme={option} mode="dark" />
          </div>
          <span className="theme-picker-label">{tr(LABEL_KEYS[option])}</span>
        </button>
      ))}
    </div>
  );
}
