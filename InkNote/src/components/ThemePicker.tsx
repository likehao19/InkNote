import type { ThemePref } from "../lib/theme";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

interface Props {
  locale: Locale;
  value: ThemePref;
  onChange: (theme: ThemePref) => void;
}

function resolvePreviewTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function ThemePreviewMock({ theme, locale }: { theme: "light" | "dark"; locale: Locale }) {
  return (
    <div className="theme-preview-mock" data-theme={theme}>
      <div className="theme-preview-sidebar" />
      <div className="theme-preview-main">
        <div className="theme-preview-bar" />
        <div className="theme-preview-editor">
          <div className="theme-preview-h">{t(locale, "themePreview.heading")}</div>
          <div className="theme-preview-p">{t(locale, "themePreview.body")}</div>
          <div className="theme-preview-code">code</div>
        </div>
      </div>
    </div>
  );
}

const OPTIONS: ThemePref[] = ["light", "dark", "system"];

const LABEL_KEYS: Record<ThemePref, Parameters<typeof t>[1]> = {
  light: "settings.theme.light",
  dark: "settings.theme.dark",
  system: "settings.theme.system",
};

export default function ThemePicker({ locale, value, onChange }: Props) {
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="theme-picker">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value === opt ? "theme-picker-card selected" : "theme-picker-card"}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
        >
          <ThemePreviewMock theme={resolvePreviewTheme(opt)} locale={locale} />
          <span className="theme-picker-label">{tr(LABEL_KEYS[opt])}</span>
        </button>
      ))}
    </div>
  );
}
