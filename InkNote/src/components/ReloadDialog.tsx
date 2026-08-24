import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  onReload: () => void;
  onDismiss: () => void;
}

export default function ReloadDialog({ locale, onReload, onDismiss }: Props) {
  useModalEscape(true, onDismiss);

  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t(locale, "reload.title")}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text">{t(locale, "reload.body")}</p>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onDismiss}>
              {t(locale, "reload.keep")}
            </button>
            <button className="btn-primary" onClick={onReload}>
              {t(locale, "reload.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
