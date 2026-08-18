import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "../lib/i18n";

const MAX = 12;

interface Props {
  open: boolean;
  locale: Locale;
  onSelect: (rows: number, cols: number) => void;
  onCancel: () => void;
}

export default function TableSizePicker({ open, locale, onSelect, onCancel }: Props) {
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const sizeRef = useRef({ rows: 0, cols: 0 });

  const setSize = (r: number, c: number) => {
    sizeRef.current = { rows: r, cols: c };
    setRows(r);
    setCols(c);
  };

  useEffect(() => {
    if (!open) setSize(0, 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && sizeRef.current.rows > 0 && sizeRef.current.cols > 0) {
        onSelect(sizeRef.current.rows, sizeRef.current.cols);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onSelect]);

  const pick = (r: number, c: number) => {
    setSize(r + 1, c + 1);
  };

  const confirm = () => {
    const { rows: r, cols: c } = sizeRef.current;
    if (r > 0 && c > 0) onSelect(r, c);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="table-size-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="table-size-picker-title">{t(locale, "tablePicker.title")}</div>
        <div
          className="table-size-grid"
          role="grid"
          aria-label={t(locale, "tablePicker.title")}
          onPointerEnter={() => {
            if (sizeRef.current.rows === 0) setSize(1, 1);
          }}
          onPointerLeave={() => setSize(0, 0)}
        >
          {Array.from({ length: MAX * MAX }, (_, i) => {
            const r = Math.floor(i / MAX);
            const c = i % MAX;
            const active = r < rows && c < cols;
            return (
              <div
                key={i}
                role="gridcell"
                className={`table-size-cell${active ? " is-active" : ""}`}
                onPointerEnter={() => pick(r, c)}
                onClick={confirm}
              />
            );
          })}
        </div>
        <div className="table-size-label">
          {rows > 0 && cols > 0
            ? t(locale, "tablePicker.size", { rows, cols })
            : t(locale, "tablePicker.hint")}
        </div>
      </div>
    </div>
  );
}
