import {
  altShortcut,
  deleteShortcut,
  findReplaceShortcut,
  fullscreenShortcut,
  modShortcut,
  redoShortcut,
} from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  onClose: () => void;
}

type MessageKey = Parameters<typeof t>[1];

const SHORTCUT_GROUPS: { titleKey: MessageKey; items: [MessageKey, string][] }[] = [
  {
    titleKey: "shortcuts.file",
    items: [
      ["shortcuts.new", modShortcut("N")],
      ["shortcuts.open", modShortcut("O")],
      ["shortcuts.save", modShortcut("S")],
      ["shortcuts.saveAs", modShortcut("Shift+S")],
      ["shortcuts.closeFile", modShortcut("W")],
      ["shortcuts.reopenClosed", modShortcut("Shift+T")],
      ["shortcuts.quickOpen", modShortcut("P")],
      ["shortcuts.settings", modShortcut(",")],
    ],
  },
  {
    titleKey: "shortcuts.edit",
    items: [
      ["shortcuts.undo", modShortcut("Z")],
      ["shortcuts.redo", redoShortcut()],
      ["menu.cut", modShortcut("X")],
      ["menu.copy", modShortcut("C")],
      ["menu.paste", modShortcut("V")],
      ["shortcuts.pastePlain", modShortcut("Shift+V")],
      ["menu.selectAll", modShortcut("A")],
      ["shortcuts.find", modShortcut("F")],
      ["shortcuts.findReplace", findReplaceShortcut()],
      ["shortcuts.globalSearch", modShortcut("Shift+F")],
    ],
  },
  {
    titleKey: "shortcuts.workspace",
    items: [
      ["tree.newFile", altShortcut("N")],
      ["tree.newFolder", altShortcut("Shift+N")],
      ["tree.open", "Enter"],
      ["tree.rename", "F2"],
      ["tree.delete", deleteShortcut()],
      ["tree.refresh", "F5"],
    ],
  },
  {
    titleKey: "shortcuts.paragraph",
    items: [
      ["menu.paragraphText", modShortcut("0")],
      ["menu.heading1", modShortcut("1")],
      ["menu.heading2", modShortcut("2")],
      ["menu.heading3", modShortcut("3")],
      ["menu.heading4", modShortcut("4")],
      ["menu.heading5", modShortcut("5")],
      ["menu.heading6", modShortcut("6")],
      ["menu.bulletList", modShortcut("Shift+8")],
      ["menu.orderedList", modShortcut("Shift+7")],
      ["menu.taskList", modShortcut("Shift+X")],
      ["menu.blockquote", modShortcut("Shift+Q")],
    ],
  },
  {
    titleKey: "shortcuts.format",
    items: [
      ["shortcuts.bold", modShortcut("B")],
      ["shortcuts.italic", modShortcut("I")],
      ["menu.inlineCode", modShortcut("Shift+`")],
      ["shortcuts.link", modShortcut("K")],
      ["shortcuts.codeBlock", modShortcut("Shift+K")],
      ["menu.mathBlock", modShortcut("Shift+M")],
      ["shortcuts.table", modShortcut("T")],
      ["shortcuts.image", modShortcut("Shift+I")],
    ],
  },
  {
    titleKey: "shortcuts.view",
    items: [
      ["shortcuts.sidebar", modShortcut("Shift+L")],
      ["shortcuts.toggleMode", modShortcut("/")],
      ["shortcuts.zoomIn", modShortcut("+")],
      ["shortcuts.zoomOut", modShortcut("-")],
      ["shortcuts.focus", "F8"],
      ["shortcuts.typewriter", "F9"],
      ["shortcuts.fullscreen", fullscreenShortcut()],
    ],
  },
  {
    titleKey: "shortcuts.components",
    items: [
      ["shortcuts.componentSelectAll", modShortcut("A")],
      ["shortcuts.tableNextCell", "Tab"],
      ["shortcuts.tablePrevCell", "Shift+Tab"],
      ["shortcuts.exitComponent", "Esc"],
    ],
  },
];

export default function ShortcutsDialog({ locale, onClose }: Props) {
  useModalEscape(true, onClose);
  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
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
                    <span>{tr(labelKey)}</span>
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
