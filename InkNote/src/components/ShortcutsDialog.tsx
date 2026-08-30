import {
  altShortcut,
  deleteShortcut,
  formatShortcut,
  modShortcut,
  redoShortcut,
  type ShortcutMap,
} from "../lib/shortcuts";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  shortcutMap: ShortcutMap;
  onClose: () => void;
}

type MessageKey = Parameters<typeof t>[1];

const shortcutGroups = (app: ShortcutMap): { titleKey: MessageKey; items: [MessageKey, string][] }[] => [
  {
    titleKey: "shortcuts.file",
    items: [
      ["shortcuts.new", formatShortcut(app.new)],
      ["shortcuts.open", formatShortcut(app.open)],
      ["shortcuts.save", formatShortcut(app.save)],
      ["shortcuts.saveAs", formatShortcut(app.saveAs)],
      ["shortcuts.closeFile", formatShortcut(app.closeFile)],
      ["shortcuts.reopenClosed", formatShortcut(app.reopenClosed)],
      ["shortcuts.quickOpen", formatShortcut(app.quickOpen)],
      ["shortcuts.settings", formatShortcut(app.settings)],
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
      ["shortcuts.find", formatShortcut(app.find)],
      ["shortcuts.findReplace", formatShortcut(app.findReplace)],
      ["shortcuts.globalSearch", formatShortcut(app.globalSearch)],
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
      ["shortcuts.sidebar", formatShortcut(app.toggleSidebar)],
      ["shortcuts.toggleMode", formatShortcut(app.toggleMode)],
      ["shortcuts.zoomIn", formatShortcut(app.zoomIn)],
      ["shortcuts.zoomOut", formatShortcut(app.zoomOut)],
      ["shortcuts.focus", formatShortcut(app.focusMode)],
      ["shortcuts.typewriter", formatShortcut(app.typewriterMode)],
      ["shortcuts.fullscreen", formatShortcut(app.fullscreen)],
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

export default function ShortcutsDialog({ locale, shortcutMap, onClose }: Props) {
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
          {shortcutGroups(shortcutMap).map((group) => (
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
