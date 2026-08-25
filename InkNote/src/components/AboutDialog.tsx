import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";
import { openUrl } from "@tauri-apps/plugin-opener";
import { GITHUB_URL } from "../lib/project";

interface Props {
  locale: Locale;
  onClose: () => void;
}

export default function AboutDialog({ locale, onClose }: Props) {
  const [version, setVersion] = useState("");
  useModalEscape(true, onClose);
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  useEffect(() => {
    void getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tr("about.title")}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text">{tr("about.body")}</p>
          {version && <p className="modal-text-muted">{t(locale, "about.version", { v: version })}</p>}
          <p className="modal-text-muted">{tr("about.tech")}</p>
          <button type="button" className="about-github-link" onClick={() => void openUrl(GITHUB_URL).catch(() => {})}>
            {tr("about.github")} · github.com/likehao19/InkNote
          </button>
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
