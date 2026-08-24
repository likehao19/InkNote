import { useCallback, useEffect, useRef, useState } from "react";

function matchesAccelerator(e: KeyboardEvent, accelerator: string): boolean {
  const mod = e.ctrlKey || e.metaKey;
  switch (accelerator) {
    case "n":
      return e.key === "n" && e.altKey && !e.shiftKey;
    case "N":
      return e.key.toLowerCase() === "n" && e.altKey && e.shiftKey;
    case "Mod+c":
      return mod && e.key.toLowerCase() === "c" && !e.shiftKey && !e.altKey;
    case "Mod+x":
      return mod && e.key.toLowerCase() === "x" && !e.shiftKey && !e.altKey;
    case "Mod+v":
      return mod && e.key.toLowerCase() === "v" && !e.shiftKey && !e.altKey;
    case "Mod+Shift+z":
      return mod && e.key.toLowerCase() === "z" && e.shiftKey && !e.altKey;
    default:
      return e.key === accelerator;
  }
}

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  shortcut?: string;
  accelerator?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  variant?: "default" | "tree";
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
  variant = "default",
}: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const focusIndexRef = useRef(0);

  const actionable = items.filter((item) => !item.separator && !item.disabled);

  const setFocus = useCallback((index: number) => {
    focusIndexRef.current = index;
    setFocusIndex(index);
  }, []);

  const activate = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled || item.separator || !item.onClick) return;
      item.onClick();
      onClose();
    },
    [onClose],
  );

  useEffect(() => {
    focusIndexRef.current = 0;
    setFocusIndex(0);
    setKeyboardNav(false);
  }, [x, y]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      const accel = actionable.find(
        (item) => item.accelerator && matchesAccelerator(e, item.accelerator),
      );
      if (accel) {
        e.preventDefault();
        activate(accel);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!actionable.length) return;
        setKeyboardNav(true);
        setFocus((focusIndexRef.current + 1) % actionable.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!actionable.length) return;
        setKeyboardNav(true);
        setFocus((focusIndexRef.current - 1 + actionable.length) % actionable.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = actionable[focusIndexRef.current];
        if (item) activate(item);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, actionable, activate, setFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x;
      let top = y;
      if (left + rect.width > vw) left = vw - rect.width - 4;
      if (top + rect.height > vh) top = vh - rect.height - 4;
      el.style.left = `${Math.max(4, left)}px`;
      el.style.top = `${Math.max(4, top)}px`;
    });
  }, [x, y, items]);

  const menuClass =
    variant === "tree" ? "context-menu context-menu--tree" : "context-menu";

  return (
    <ul
      ref={ref}
      className={menuClass}
      style={{ left: x, top: y }}
      role="menu"
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
      onMouseMove={() => setKeyboardNav(false)}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <li
              key={`sep-${i}`}
              className="context-menu-sep"
              role="separator"
              aria-hidden="true"
            />
          );
        }

        const actionIndex = actionable.indexOf(item);
        const isFocused =
          keyboardNav && actionIndex >= 0 && actionIndex === focusIndex;

        return (
          <li key={`${item.label}-${i}`} className="context-menu-row" role="none">
            <button
              type="button"
              className={[
                "context-menu-item",
                item.danger ? "danger" : "",
                isFocused ? "focused" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="menuitem"
              disabled={item.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => activate(item)}
            >
              <span className="context-menu-item-label">{item.label}</span>
              {item.shortcut ? (
                <span className="context-menu-shortcut">{item.shortcut}</span>
              ) : (
                <span className="context-menu-shortcut" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
