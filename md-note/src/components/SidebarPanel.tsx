import { useCallback, useRef, type ReactNode } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import {
  SIDEBAR_COLLAPSE_WIDTH,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "../lib/preferences";

interface PanelProps {
  locale: Locale;
  width: number;
  onWidthChange: (width: number) => void;
  onHide: () => void;
  children: ReactNode;
}

const SIDEBAR_DRAG_MIN = 48;

function clampWidth(w: number) {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, w));
}

function dragWidth(w: number) {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_DRAG_MIN, w));
}

export function SidebarPanel({ locale, width, onWidthChange, onHide, children }: PanelProps) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(width);

  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  const endDrag = useCallback(
    (target: HTMLElement, pointerId: number, finalWidth: number) => {
      draggingRef.current = false;
      document.body.classList.remove("sidebar-resizing");
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      if (finalWidth < SIDEBAR_COLLAPSE_WIDTH) {
        onHide();
        onWidthChange(startWRef.current);
      } else {
        onWidthChange(clampWidth(finalWidth));
      }
    },
    [onHide, onWidthChange],
  );

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = width;
    document.body.classList.add("sidebar-resizing");
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = startWRef.current + e.clientX - startXRef.current;
    onWidthChange(dragWidth(next));
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const finalWidth = startWRef.current + e.clientX - startXRef.current;
    endDrag(e.currentTarget, e.pointerId, finalWidth);
  };

  const onHandleDoubleClick = () => {
    onWidthChange(SIDEBAR_WIDTH_DEFAULT);
  };

  return (
    <>
      <div className="sidebar-shell" style={{ width }}>
        {children}
      </div>
      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={tr("sidebar.resize")}
        title={tr("sidebar.resize")}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={(e) => {
          if (draggingRef.current) endDrag(e.currentTarget, e.pointerId, startWRef.current);
        }}
        onDoubleClick={onHandleDoubleClick}
      />
    </>
  );
}
