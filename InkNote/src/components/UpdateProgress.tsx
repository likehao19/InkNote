import { t, type Locale } from "../lib/i18n";

export type UpdateProgressState = {
  phase: "checking" | "downloading" | "installing";
  version?: string;
  percent: number;
  downloaded: number;
  total: number;
};

interface Props {
  locale: Locale;
  state: UpdateProgressState | null;
}

function formatBytes(value: number, locale: Locale): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = Math.max(0, value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  })} ${units[unit]}`;
}

export default function UpdateProgress({ locale, state }: Props) {
  if (!state) return null;

  const determinate = state.phase === "downloading" && state.total > 0;
  const label = state.phase === "checking"
    ? t(locale, "update.checking")
    : state.phase === "installing"
      ? t(locale, "update.installing")
      : determinate
        ? t(locale, "update.downloading", { n: state.percent })
        : t(locale, "update.downloadingUnknown");
  const detail = determinate
    ? `${formatBytes(state.downloaded, locale)} / ${formatBytes(state.total, locale)}`
    : state.version
      ? `v${state.version}`
      : null;

  return (
    <section className="update-progress" role="status" aria-live="polite">
      <div className="update-progress-copy">
        <span>{label}</span>
        {detail && <span className="update-progress-detail">{detail}</span>}
      </div>
      <div
        className={`update-progress-track${determinate ? "" : " indeterminate"}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={determinate ? state.percent : undefined}
      >
        <span style={determinate ? { width: `${state.percent}%` } : undefined} />
      </div>
    </section>
  );
}
