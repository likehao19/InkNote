import { useCallback, useEffect, useRef, useState } from "react";
import { t, type Locale } from "../lib/i18n";

const GRID_MAX = 12;
const CUSTOM_MAX = 30;

interface Props {
  open: boolean;
  locale: Locale;
  onSelect: (rows: number, cols: number) => void;
  onCancel: () => void;
}

function clampSize(n: number): number {
  return Math.min(CUSTOM_MAX, Math.max(1, Math.floor(n) || 1));
}

export default function TableSizePicker({ open, locale, onSelect, onCancel }: Props) {
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [customRows, setCustomRows] = useState("3");
  const [customCols, setCustomCols] = useState("3");
  const sizeRef = useRef({ rows: 0, cols: 0 });

  const setSize = useCallback((r: number, c: number) => {
    const nr = clampSize(r);
    const nc = clampSize(c);
    sizeRef.current = { rows: nr, cols: nc };
    setRows(nr);
    setCols(nc);
    setCustomRows(String(nr));
    setCustomCols(String(nc));
  }, []);

  useEffect(() => {
    if (!open) {
      sizeRef.current = { rows: 0, cols: 0 };
      setRows(0);
      setCols(0);
      setCustomRows("3");
      setCustomCols("3");
    }
  }, [open]);

  const confirm = useCallback(() => {
    let { rows: r, cols: c } = sizeRef.current;
    if (r === 0 || c === 0) {
      r = clampSize(Number(customRows));
      c = clampSize(Number(customCols));
    }
    if (r > 0 && c > 0) onSelect(r, c);
  }, [onSelect, customRows, customCols]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key) &&
        !(e.target instanceof HTMLInputElement)
      ) {
        e.preventDefault();
        let { rows: r, cols: c } = sizeRef.current;
        if (r === 0 || c === 0) {
          setSize(1, 1);
          return;
        }
        if (e.key === "ArrowUp") setSize(r - 1, c);
        else if (e.key === "ArrowDown") setSize(r + 1, c);
        else if (e.key === "ArrowLeft") setSize(r, c - 1);
        else if (e.key === "ArrowRight") setSize(r, c + 1);
        else if (e.key === "Enter") confirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, confirm, setSize]);

  const pick = (r: number, c: number) => {
    setSize(r + 1, c + 1);
  };

  const applyCustom = () => {
    setSize(Number(customRows), Number(customCols));
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="table-size-picker" onClick={(e) => e.stopPropagation()}>
        <div className="table-size-picker-title">{t(locale, "tablePicker.title")}</div>
        <div
          className="table-size-grid"
          role="grid"
          aria-label={t(locale, "tablePicker.title")}
          onPointerEnter={() => {
            if (sizeRef.current.rows === 0) setSize(1, 1);
          }}
        >
          {Array.from({ length: GRID_MAX * GRID_MAX }, (_, i) => {
            const r = Math.floor(i / GRID_MAX);
            const c = i % GRID_MAX;
            const active = rows > 0 && cols > 0 && r < rows && c < cols;
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
        <div className="table-size-custom">
          <span className="table-size-custom-label">{t(locale, "tablePicker.customSize")}</span>
          <label className="table-size-custom-field">
            <span>{t(locale, "tablePicker.rows")}</span>
            <input
              type="number"
              min={1}
              max={CUSTOM_MAX}
              value={customRows}
              onChange={(e) => setCustomRows(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCustom();
              }}
            />
          </label>
          <span className="table-size-custom-x">×</span>
          <label className="table-size-custom-field">
            <span>{t(locale, "tablePicker.cols")}</span>
            <input
              type="number"
              min={1}
              max={CUSTOM_MAX}
              value={customCols}
              onChange={(e) => setCustomCols(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCustom();
              }}
            />
          </label>
          <button type="button" className="table-size-confirm" onClick={confirm}>
            {t(locale, "tablePicker.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
