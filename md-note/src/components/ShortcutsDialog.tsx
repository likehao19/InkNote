import { modShortcut } from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  onClose: () => void;
}

const SHORTCUT_GROUPS: { titleKey: Parameters<typeof t>[1]; items: [string, string][] }[] = [
  {
    titleKey: "shortcuts.file",
    items: [
      ["shortcuts.new", modShortcut("N")],
      ["shortcuts.open", modShortcut("O")],
      ["shortcuts.save", modShortcut("S")],
      ["shortcuts.saveAs", modShortcut("Shift+S")],
      ["shortcuts.closeFile", modShortcut("W")],
      ["shortcuts.settings", modShortcut(",")],
    ],
  },
  {
    titleKey: "shortcuts.edit",
    items: [
      ["shortcuts.undo", modShortcut("Z")],
      ["shortcuts.redo", modShortcut("Y")],
      ["shortcuts.find", modShortcut("F")],
      ["shortcuts.findReplace", modShortcut("H")],
      ["shortcuts.globalSearch", modShortcut("Shift+F")],
      ["shortcuts.quickOpen", modShortcut("P")],
      ["shortcuts.toggleMode", modShortcut("/")],
    ],
  },
  {
    titleKey: "shortcuts.format",
    items: [
      ["shortcuts.bold", modShortcut("B")],
      ["shortcuts.italic", modShortcut("I")],
      ["shortcuts.link", modShortcut("K")],
      ["shortcuts.codeBlock", modShortcut("Shift+K")],
      ["shortcuts.table", modShortcut("T")],
      ["shortcuts.image", modShortcut("Shift+I")],
    ],
  },
  {
    titleKey: "shortcuts.view",
    items: [
      ["shortcuts.sidebar", modShortcut("Shift+L")],
      ["shortcuts.focus", "F8"],
      ["shortcuts.typewriter", "F9"],
    ],
  },
];

export default function ShortcutsDialog({ locale, onClose }: Props) {
  useModalEscape(true, onClose);
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tr("shortcuts.title")}</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label={tr("dialog.close")}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-body shortcuts-body">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.titleKey} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{tr(group.titleKey)}</h3>
              <ul className="shortcuts-list">
                {group.items.map(([labelKey, shortcut]) => (
                  <li key={labelKey} className="shortcuts-row">
                    <span>{tr(labelKey as Parameters<typeof t>[1])}</span>
                    <kbd className="shortcuts-kbd">{shortcut}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
