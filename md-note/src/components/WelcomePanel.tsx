import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

interface Props {
  locale: Locale;
  recentFiles: string[];
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenSample: () => void;
  onOpenRecent: (path: string) => void;
  onOpenSettings: () => void;
}

export default function WelcomePanel({
  locale,
  recentFiles,
  onNew,
  onOpen,
  onOpenFolder,
  onOpenSample,
  onOpenRecent,
  onOpenSettings,
}: Props) {
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="welcome-panel">
      <div className="welcome-orb welcome-orb-1" aria-hidden="true" />
      <div className="welcome-orb welcome-orb-2" aria-hidden="true" />
      <div className="welcome-content welcome-animate-in">
        <h1 className="welcome-title welcome-animate-item">{tr("welcome.title")}</h1>
        <p className="welcome-desc welcome-animate-item welcome-animate-delay-1">{tr("welcome.desc")}</p>
        <div className="welcome-actions">
          <button type="button" className="btn-primary welcome-animate-item welcome-animate-delay-2" onClick={onNew}>
            {tr("welcome.new")}
          </button>
          <button type="button" className="btn-secondary welcome-animate-item welcome-animate-delay-3" onClick={onOpen}>
            {tr("welcome.open")}
          </button>
          <button type="button" className="btn-secondary welcome-animate-item welcome-animate-delay-4" onClick={onOpenFolder}>
            {tr("welcome.openFolder")}
          </button>
          <button type="button" className="btn-secondary welcome-animate-item welcome-animate-delay-5" onClick={onOpenSample}>
            {tr("welcome.sample")}
          </button>
        </div>
        {recentFiles.length > 0 && (
          <div className="welcome-recent welcome-animate-item welcome-animate-delay-6">
            <h2 className="welcome-recent-title">{tr("welcome.recent")}</h2>
            <ul className="welcome-recent-list">
              {recentFiles.slice(0, 5).map((path) => (
                <li key={path}>
                  <button type="button" className="welcome-recent-item" onClick={() => onOpenRecent(path)}>
                    <span className="welcome-recent-name">{path.split(/[\\/]/).pop() ?? path}</span>
                    <span className="welcome-recent-path">{path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="welcome-settings-link welcome-animate-item welcome-animate-delay-8"
          onClick={onOpenSettings}
        >
          {tr("welcome.settings")}
        </button>
      </div>
    </div>
  );
}
