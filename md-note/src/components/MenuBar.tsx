import { useCallback, useEffect, useRef, useState } from "react";

export interface MenuItemDef {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  /** When defined, reserves a leading check gutter (VS Code / Cursor style). */
  checked?: boolean;
  disabled?: boolean;
}

function MenuCheck({ checked }: { checked: boolean }) {
  return (
    <span className={`menubar-check${checked ? " is-checked" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
      </svg>
    </span>
  );
}

export interface MenuGroupDef {
  label: string;
  items: MenuItemDef[];
}

interface Props {
  groups: MenuGroupDef[];
}

export default function MenuBar({ groups }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const barRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex, close]);

  return (
    <nav className="menubar" ref={barRef} role="menubar">
      {groups.map((group, i) => (
        <div key={group.label} className="menubar-group" role="none">
          <button
            type="button"
            className={openIndex === i ? "menubar-trigger active" : "menubar-trigger"}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openIndex === i}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            onMouseEnter={() => {
              if (openIndex !== null) setOpenIndex(i);
            }}
            data-tauri-drag-region={false}
          >
            {group.label}
          </button>
          {openIndex === i && (
            <ul className="menubar-dropdown" role="menu">
              {group.items.map((item, j) =>
                item.separator ? (
                  <li key={`sep-${j}`} className="menubar-sep" role="separator" />
                ) : (
                  <li key={item.label} role="none">
                    <button
                      type="button"
                      className={
                        item.checked !== undefined
                          ? "menubar-item menubar-item--toggle"
                          : "menubar-item"
                      }
                      role="menuitem"
                      aria-checked={item.checked !== undefined ? item.checked : undefined}
                      disabled={item.disabled}
                      onClick={() => {
                        item.action?.();
                        close();
                      }}
                      data-tauri-drag-region={false}
                    >
                      {item.checked !== undefined && (
                        <MenuCheck checked={item.checked} />
                      )}
                      <span className="menubar-item-label">{item.label}</span>
                      {item.shortcut && (
                        <span className="menubar-shortcut">{item.shortcut}</span>
                      )}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
