import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import type { TabDoc } from "../store/useTabsStore";
import { basename } from "../lib/paths";
import { t, type Locale } from "../lib/i18n";
import ContextMenu from "./ContextMenu";

export default function DocumentTabs({ tabs, activeId, locale, onSelect, onClose, onCloseMany, onNew, onCopyPath }: {
  tabs: TabDoc[];
  activeId: string;
  locale: Locale;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCloseMany: (ids: string[]) => void;
  onNew: () => void;
  onCopyPath: (path: string) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuIndex = menu ? tabs.findIndex((tab) => tab.id === menu.id) : -1;
  const closeMenu = () => setMenu(null);
  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId]);
  return <div className="document-tabs">
    <div ref={strip} role="tablist" aria-label={t(locale, "tabs.documents")} className="document-tab-list" onScroll={closeMenu}>
      {tabs.map((tab, index) => {
        const name = tab.path ? basename(tab.path) : t(locale, "title.untitled");
        return <div key={tab.id} className={`document-tab${tab.id === activeId ? " is-active" : ""}`}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu({ id: tab.id, x: event.clientX || rect.left, y: event.clientY || rect.bottom });
          }}>
          <button type="button" role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`}
            aria-selected={tab.id === activeId} tabIndex={tab.id === activeId ? 0 : -1}
            title={tab.path ?? name} onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              onSelect(tabs[next].id);
              requestAnimationFrame(() => (strip.current?.querySelectorAll('[role="tab"]')[next] as HTMLElement)?.focus());
            }}>
            <span className="document-tab-name">{name}</span>
            {tab.dirty && <span className="document-tab-dirty" aria-label={t(locale, "tabs.unsaved")}>●</span>}
          </button>
          <button type="button" className="document-tab-close" aria-label={t(locale, "tabs.close", { name })}
            onClick={() => onClose(tab.id)}><X size={13} /></button>
        </div>;
      })}
    </div>
    <button type="button" className="document-tab-new" aria-label={t(locale, "tabs.new")} title={t(locale, "tabs.new")} onClick={onNew}><Plus size={16} /></button>
    {menu && menuIndex >= 0 && createPortal(<ContextMenu x={menu.x} y={menu.y} onClose={closeMenu} items={[
      { label: t(locale, "tree.copyAbsolutePath"), disabled: !tabs[menuIndex].path,
        onClick: () => { const path = tabs[menuIndex].path; if (path) onCopyPath(path); } },
      { label: "", separator: true },
      { label: t(locale, "tabs.closeCurrent"), onClick: () => onClose(menu.id) },
      { label: t(locale, "tabs.closeOthers"), disabled: tabs.length <= 1,
        onClick: () => onCloseMany(tabs.filter((tab) => tab.id !== menu.id).map((tab) => tab.id)) },
      { label: t(locale, "tabs.closeLeft"), disabled: menuIndex === 0,
        onClick: () => onCloseMany(tabs.slice(0, menuIndex).map((tab) => tab.id)) },
      { label: t(locale, "tabs.closeRight"), disabled: menuIndex === tabs.length - 1,
        onClick: () => onCloseMany(tabs.slice(menuIndex + 1).map((tab) => tab.id)) },
      { label: "", separator: true },
      { label: t(locale, "tabs.closeAll"), onClick: () => onCloseMany(tabs.map((tab) => tab.id)) },
    ]} />, document.body)}
  </div>;
}
