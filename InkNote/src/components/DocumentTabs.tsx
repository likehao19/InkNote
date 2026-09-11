import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import type { TabDoc } from "../store/useTabsStore";
import { basename } from "../lib/paths";
import { t, type Locale } from "../lib/i18n";

export default function DocumentTabs({ tabs, activeId, locale, onSelect, onClose, onNew }: {
  tabs: TabDoc[];
  activeId: string;
  locale: Locale;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId]);
  return <div className="document-tabs">
    <div ref={strip} role="tablist" aria-label={t(locale, "tabs.documents")} className="document-tab-list">
      {tabs.map((tab, index) => {
        const name = tab.path ? basename(tab.path) : t(locale, "title.untitled");
        return <div key={tab.id} className={`document-tab${tab.id === activeId ? " is-active" : ""}`}>
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
  </div>;
}
