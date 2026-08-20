import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  onClose: () => void;
}

export default function AboutDialog({ locale, onClose }: Props) {
  useModalEscape(true, onClose);
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tr("about.title")}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text">{tr("about.body")}</p>
          <p className="modal-text-muted">{t(locale, "about.version", { v: "0.1.0" })}</p>
          <p className="modal-text-muted">{tr("about.tech")}</p>
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={onClose}>
              {tr("dialog.ok")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
