import { Download, PackageOpen, RefreshCw } from "lucide-react";
import { t, type Locale } from "../lib/i18n";

export type UpdateProgressState = {
  phase: "checking" | "available" | "downloading" | "installing";
  version?: string;
  percent: number;
  downloaded: number;
  total: number;
};

interface Props {
  locale: Locale;
  state: UpdateProgressState | null;
  onInstall: () => void;
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

export default function UpdateProgress({ locale, state, onInstall }: Props) {
  if (!state) return <div className="update-slot" aria-hidden="true" />;

  const determinate = state.phase === "downloading" && state.total > 0;
  const label = state.phase === "checking"
    ? t(locale, "update.checking")
    : state.phase === "available"
      ? t(locale, "update.action", { v: state.version ?? "" })
      : state.phase === "installing"
        ? t(locale, "update.installing")
        : determinate
          ? t(locale, "update.downloading", { n: state.percent })
          : t(locale, "update.downloadingUnknown");
  const detail = state.phase === "downloading" && determinate
    ? `${formatBytes(state.downloaded, locale)} / ${formatBytes(state.total, locale)}`
    : null;
  const Icon = state.phase === "available"
    ? PackageOpen
    : state.phase === "installing" || state.phase === "checking"
      ? RefreshCw
      : Download;
  const busy = state.phase !== "available";

  return (
    <div className="update-slot">
      <button
        type="button"
        className={`update-control ${state.phase}`}
        disabled={busy}
        onClick={onInstall}
        title={label}
      >
        <Icon className="update-control-icon" size={14} strokeWidth={2.2} aria-hidden="true" />
        <span className="update-control-label" aria-live="polite">{label}</span>
        {detail && <span className="update-control-detail">{detail}</span>}
      </button>
      {(state.phase === "downloading" || state.phase === "installing") && (
        <div
          className={`update-control-track${determinate ? "" : " indeterminate"}`}
          role="progressbar"
          aria-label={label}
          aria-valuemin={determinate ? 0 : undefined}
          aria-valuemax={determinate ? 100 : undefined}
          aria-valuenow={determinate ? state.percent : undefined}
        >
          <span style={determinate ? { width: `${state.percent}%` } : undefined} />
        </div>
      )}
    </div>
  );
}
