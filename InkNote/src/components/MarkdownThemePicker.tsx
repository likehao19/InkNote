import type { Locale, MessageKey } from "../lib/i18n";
import { t } from "../lib/i18n";
import {
  MARKDOWN_THEMES,
  type MarkdownTheme,
  type MarkdownThemeGroup,
} from "../lib/markdownTheme";

interface Props {
  locale: Locale;
  value: MarkdownTheme;
  onChange: (theme: MarkdownTheme) => void;
}

const GROUPS: Array<{ id: MarkdownThemeGroup; titleKey: MessageKey }> = [
  { id: "typora", titleKey: "settings.markdownTheme.group.typora" },
  { id: "curated", titleKey: "settings.markdownTheme.group.curated" },
  { id: "classic", titleKey: "settings.markdownTheme.group.classic" },
];

function labelKey(theme: MarkdownTheme): MessageKey {
  return `settings.markdownTheme.${theme}` as MessageKey;
}

function descKey(theme: MarkdownTheme): MessageKey {
  return `settings.markdownTheme.${theme}.desc` as MessageKey;
}

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
  const tr = (key: MessageKey) => t(locale, key);

  return (
    <div className="markdown-theme-groups">
      {GROUPS.map((group) => {
        const items = MARKDOWN_THEMES.filter((item) => item.group === group.id);
        return (
          <div key={group.id} className="markdown-theme-group">
            <div className="markdown-theme-group-title">{tr(group.titleKey)}</div>
            <div className="theme-picker markdown-theme-picker">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={value === item.id ? "theme-picker-card selected" : "theme-picker-card"}
                  onClick={() => onChange(item.id)}
                  aria-pressed={value === item.id}
                >
                  <div className="md-theme-preview" aria-hidden="true">
                    <DocumentPreview theme={item.id} mode="light" />
                    <DocumentPreview theme={item.id} mode="dark" />
                  </div>
                  <div className="theme-picker-meta">
                    <span className="theme-picker-label">{tr(labelKey(item.id))}</span>
                    <span className="theme-picker-sub">{tr(descKey(item.id))}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
