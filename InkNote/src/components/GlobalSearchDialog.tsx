import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";
import { basename, dirOf } from "../lib/paths";
import {
  hasSearchScope,
  searchWorkspace,
  type SearchMatch,
} from "../lib/workspaceSearch";

interface Props {
  locale: Locale;
  folderPaths: string[];
  onOpenResult: (path: string, line: number) => void;
  onOpenFolder: () => void;
  onClose: () => void;
}

function HighlightedLine({ text, start, end }: { text: string; start: number; end: number }) {
  const before = text.slice(0, start);
  const match = text.slice(start, end);
  const after = text.slice(end);
  const display =
    before.length > 40 ? `…${before.slice(-40)}` : before;
  return (
    <span className="global-search-snippet">
      {display}
      <mark className="global-search-mark">{match}</mark>
      {after.length > 60 ? `${after.slice(0, 60)}…` : after}
    </span>
  );
}

export default function GlobalSearchDialog({
  locale,
  folderPaths,
  onOpenResult,
  onOpenFolder,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [filenameOnly, setFilenameOnly] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestRef = useRef(0);

  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) =>
    t(locale, key, vars);

  useModalEscape(true, onClose);

  const scoped = hasSearchScope(folderPaths, []);

  const runSearch = useCallback(
    async (q: string) => {
      const request = ++requestRef.current;
      const trimmed = q.trim();
      if (!trimmed || !scoped) {
        setMatches([]);
        setFileCount(0);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const result = await searchWorkspace(folderPaths, [], trimmed, {
          filenameOnly,
          useRegex,
        });
        if (request !== requestRef.current) return;
        setMatches(result.matches);
        setFileCount(result.fileCount);
        setActiveIndex(0);
      } catch {
        if (request === requestRef.current) {
          setMatches([]);
          setFileCount(0);
        }
      } finally {
        if (request === requestRef.current) setSearching(false);
      }
    },
    [folderPaths, scoped, filenameOnly, useRegex],
  );

  useEffect(() => {
    if (!query.trim() || !scoped) {
      requestRef.current++;
      setSearching(false);
      setMatches([]);
      setFileCount(0);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => void runSearch(query), 280);
    return () => clearTimeout(timer);
  }, [query, runSearch, scoped]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(".global-search-item.active");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, matches]);

  const openAt = (m: SearchMatch) => {
    onOpenResult(m.path, m.line);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && matches[activeIndex]) {
      e.preventDefault();
      openAt(matches[activeIndex]);
    }
  };

  const grouped = matches.reduce<Record<string, SearchMatch[]>>((acc, m) => {
    (acc[m.path] ??= []).push(m);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal global-search-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="global-search-header">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="global-search-icon">
            <circle cx="6.5" cy="6.5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="global-search-input"
            placeholder={tr("globalSearch.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && (
            <span className="global-search-status global-search-loading">
              <span className="global-search-spinner" aria-hidden="true" />
              {tr("globalSearch.searching")}
            </span>
          )}
        </div>
        <div className="global-search-options">
          <label className="global-search-option">
            <input type="checkbox" checked={filenameOnly} onChange={(e) => setFilenameOnly(e.target.checked)} />
            {tr("globalSearch.filenameOnly")}
          </label>
          <label className="global-search-option">
            <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
            {tr("globalSearch.regex")}
          </label>
        </div>

        <div className="global-search-body">
          {!scoped ? (
            <div className="global-search-empty">
              <p>{tr("globalSearch.noScope")}</p>
              <button type="button" className="btn-secondary btn-sm" onClick={onOpenFolder}>
                {tr("globalSearch.openFolder")}
              </button>
            </div>
          ) : query.trim() && !searching && matches.length === 0 ? (
            <div className="global-search-empty">{tr("globalSearch.noResults")}</div>
          ) : matches.length > 0 ? (
            <ul className="global-search-list" ref={listRef}>
              {Object.entries(grouped).map(([path, items]) => (
                <li key={path} className="global-search-group">
                  <div className="global-search-file" title={path}>
                    <span className="global-search-file-name">{basename(path)}</span>
                    <span className="global-search-file-dir">{dirOf(path)}</span>
                  </div>
                  <ul className="global-search-matches">
                    {items.map((m) => {
                      const idx = flatIndex++;
                      const isActive = idx === activeIndex;
                      return (
                        <li key={`${m.path}:${m.line}:${m.matchStart}`}>
                          <button
                            type="button"
                            className={
                              isActive
                                ? "global-search-item active"
                                : "global-search-item"
                            }
                            onClick={() => openAt(m)}
                            onMouseEnter={() => setActiveIndex(idx)}
                          >
                            <span className="global-search-line">{tr("status.line", { n: m.line })}</span>
                            <HighlightedLine
                              text={m.lineText}
                              start={m.matchStart}
                              end={m.matchEnd}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <div className="global-search-hint">
              {scoped
                ? tr("globalSearch.hint", { n: fileCount })
                : tr("globalSearch.noScope")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
