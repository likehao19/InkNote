import { useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  defaultAlt: string;
  onBrowse: () => Promise<string | null>;
  onConfirm: (alt: string, path: string) => void;
  onCancel: () => void;
}

export default function ImageInsertDialog({
  locale,
  defaultAlt,
  onBrowse,
  onConfirm,
  onCancel,
}: Props) {
  const [alt, setAlt] = useState(defaultAlt);
  const [path, setPath] = useState("");
  useModalEscape(true, onCancel);

  const browse = async () => {
    const picked = await onBrowse();
    if (picked) setPath(picked);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t(locale, "dialog.imageTitle")}</h2>
        </div>
        <div className="modal-body">
          <div className="setting-row">
            <div className="setting-label">{t(locale, "dialog.imageAlt")}</div>
            <div className="setting-control">
              <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-label">{t(locale, "dialog.imagePath")}</div>
            <div className="setting-control setting-control-row">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={t(locale, "dialog.imagePathPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && path.trim()) onConfirm(alt, path.trim());
                  if (e.key === "Escape") onCancel();
                }}
              />
              <button type="button" className="btn-secondary" onClick={() => void browse()}>
                {t(locale, "dialog.browse")}
              </button>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {t(locale, "dialog.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!path.trim()}
              onClick={() => onConfirm(alt, path.trim())}
            >
              {t(locale, "dialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
