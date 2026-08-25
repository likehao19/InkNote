import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  fileName: string;
  onOverwrite: () => void;
  onRename: () => void;
  onCancel: () => void;
}

export default function FileConflictDialog({
  locale,
  fileName,
  onOverwrite,
  onRename,
  onCancel,
}: Props) {
  useModalEscape(true, onCancel);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{t(locale, "importConflict.title")}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text">{t(locale, "importConflict.body", { name: fileName })}</p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {t(locale, "dialog.cancel")}
            </button>
            <button type="button" className="btn-secondary" onClick={onRename}>
              {t(locale, "importConflict.rename")}
            </button>
            <button type="button" className="btn-primary" onClick={onOverwrite}>
              {t(locale, "importConflict.overwrite")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
