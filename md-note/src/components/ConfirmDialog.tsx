import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  locale,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  useModalEscape(true, onCancel);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title ?? t(locale, "dialog.confirmTitle")}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text">{message}</p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {cancelLabel ?? t(locale, "dialog.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={onConfirm}>
              {confirmLabel ?? t(locale, "dialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
