import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  title: string;
  message: string;
  onClose: () => void;
}

export default function AlertDialog({ locale, title, message, onClose }: Props) {
  useModalEscape(true, onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text modal-text-pre">{message}</p>
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={onClose}>
              {t(locale, "dialog.ok")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
