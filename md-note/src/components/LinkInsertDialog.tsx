import { useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  defaultText: string;
  onConfirm: (text: string, url: string) => void;
  onCancel: () => void;
}

export default function LinkInsertDialog({ locale, defaultText, onConfirm, onCancel }: Props) {
  const [text, setText] = useState(defaultText);
  const [url, setUrl] = useState("https://");
  useModalEscape(true, onCancel);

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized =
      /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("/")
        ? trimmed
        : `https://${trimmed}`;
    onConfirm(text.trim() || normalized, normalized);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t(locale, "dialog.linkTitle")}</h2>
        </div>
        <div className="modal-body">
          <div className="setting-row">
            <div className="setting-label">{t(locale, "dialog.linkText")}</div>
            <div className="setting-control">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus={!defaultText}
              />
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-label">{t(locale, "dialog.linkUrl")}</div>
            <div className="setting-control">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                autoFocus={!!defaultText}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") onCancel();
                }}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {t(locale, "dialog.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={submit}>
              {t(locale, "dialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
