import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";
import { basename, dirOf } from "../lib/paths";
import { listWorkspaceFiles, scorePathMatch } from "../lib/workspaceSearch";

interface Props {
  locale: Locale;
  folderPath: string | null;
  recentFiles: string[];
  currentPath: string | null;
  onOpen: (path: string) => void;
  onClose: () => void;
}

export default function QuickOpenDialog({
  locale,
  folderPath,
  recentFiles,
  currentPath,
  onOpen,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);
  useModalEscape(true, onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listWorkspaceFiles(folderPath, recentFiles).then((list) => {
      if (!cancelled) {
        setFiles(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, recentFiles]);

  const results = useCallback(() => {
    const q = query.trim();
    let list = files;
    if (q) {
      list = files
        .map((p) => ({ p, s: scorePathMatch(q, p) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.p);
    }
    return list.slice(0, 40);
  }, [files, query])();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(".quick-open-item.active");
    if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  const pick = (path: string) => {
    onOpen(path);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal global-search-modal quick-open-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="global-search-header">
          <input
            ref={inputRef}
            type="search"
            className="global-search-input"
            placeholder={tr("quickOpen.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <span className="global-search-status">{tr("globalSearch.searching")}</span>}
        </div>
        <div className="global-search-body">
          {results.length === 0 ? (
            <div className="global-search-empty">
              {loading ? tr("globalSearch.searching") : tr("quickOpen.noResults")}
            </div>
          ) : (
            <ul className="global-search-list quick-open-list" ref={listRef}>
              {results.map((path, i) => (
                <li key={path}>
                  <button
                    type="button"
                    className={
                      i === activeIndex
                        ? "global-search-item quick-open-item active"
                        : "global-search-item quick-open-item"
                    }
                    onClick={() => pick(path)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="quick-open-name">
                      {basename(path)}
                      {currentPath === path && (
                        <span className="quick-open-current">{tr("quickOpen.current")}</span>
                      )}
                    </span>
                    <span className="quick-open-dir">{dirOf(path)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
