import { useCallback, useEffect, useRef, useState } from "react";

export interface MenuItemDef {
  label: string;
  title?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  /** When defined, reserves a leading check gutter (VS Code / Cursor style). */
  checked?: boolean;
  disabled?: boolean;
  children?: MenuItemDef[];
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

function SubmenuArrow() {
  return (
    <svg
      className="menubar-submenu-arrow"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
    </svg>
  );
}

export interface MenuGroupDef {
  label: string;
  items: MenuItemDef[];
}

interface Props {
  groups: MenuGroupDef[];
}

function MenuLeafItem({
  item,
  onActivate,
}: {
  item: MenuItemDef;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      className="menubar-item menubar-item--with-gutter"
      role="menuitem"
      aria-checked={item.checked !== undefined ? item.checked : undefined}
      disabled={item.disabled}
      title={item.title}
      onMouseDown={(e) => {
        // WebView 中避免 mousedown 抢焦点导致菜单在 click 前关闭、动作不触发
        e.preventDefault();
        item.action?.();
        onActivate();
      }}
      data-tauri-drag-region={false}
    >
      <MenuCheck checked={item.checked === true} />
      <span className="menubar-item-label">{item.label}</span>
      {item.shortcut && <span className="menubar-shortcut">{item.shortcut}</span>}
    </button>
  );
}

function MenuSubmenuItem({
  item,
  onClose,
}: {
  item: MenuItemDef;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={rowRef}
      className={`menubar-submenu-row${open ? " is-open" : ""}`}
      role="none"
      onMouseEnter={() => {
        if (!item.disabled) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="menubar-item menubar-item--submenu menubar-item--with-gutter"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={item.disabled}
        data-tauri-drag-region={false}
      >
        <MenuCheck checked={false} />
        <span className="menubar-item-label">{item.label}</span>
        <SubmenuArrow />
      </button>
      {open && !item.disabled && item.children && (
        <ul className="menubar-submenu" role="menu">
          {item.children.map((child, j) =>
            child.separator ? (
              <li key={`sep-${j}`} className="menubar-sep" role="separator" />
            ) : (
              <li key={child.label} role="none">
                <MenuLeafItem
                  item={child}
                  onActivate={onClose}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </li>
  );
}

function renderMenuItem(item: MenuItemDef, j: number, onClose: () => void) {
  if (item.separator) {
    return <li key={`sep-${j}`} className="menubar-sep" role="separator" />;
  }
  if (item.children?.length) {
    return <MenuSubmenuItem key={item.label} item={item} onClose={onClose} />;
  }
  return (
    <li key={item.label} role="none">
      <MenuLeafItem item={item} onActivate={onClose} />
    </li>
  );
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
              {group.items.map((item, j) => renderMenuItem(item, j, close))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
