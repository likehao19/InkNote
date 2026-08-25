import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { useModalEscape } from "../lib/useModalEscape";

interface Props {
  locale: Locale;
  content: string;
  editable: boolean;
  initialReplace: boolean;
  initialQuery: string;
  onSelectLine: (line: number) => void;
  onReplaceContent: (content: string, line: number) => void;
  onClose: () => void;
}

export interface DocumentSearchMatch {
  from: number;
  to: number;
  line: number;
  lineText: string;
  lineStart: number;
  lineEnd: number;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidRegex(value: string) {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

export function collectDocumentMatches(content: string, query: string, caseSensitive: boolean, useRegex: boolean): DocumentSearchMatch[] {
  if (!query) return [];
  let expression: RegExp;
  try {
    expression = new RegExp(useRegex ? query : escapeRegex(query), caseSensitive ? "g" : "gi");
  } catch {
    return [];
  }

  const matches: DocumentSearchMatch[] = [];
  const lines = content.split("\n");
  let offset = 0;
  for (let index = 0; index < lines.length; index++) {
    const lineText = lines[index];
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(lineText))) {
      matches.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        line: index + 1,
        lineText,
        lineStart: match.index,
        lineEnd: match.index + match[0].length,
      });
      if (!match[0].length) expression.lastIndex++;
    }
    offset += lineText.length + 1;
  }
  return matches;
}

function HighlightedLine({ match }: { match: DocumentSearchMatch }) {
  const before = match.lineText.slice(0, match.lineStart);
  const selected = match.lineText.slice(match.lineStart, match.lineEnd);
  const after = match.lineText.slice(match.lineEnd);
  return (
    <span className="global-search-snippet">
      {before.length > 40 ? `…${before.slice(-40)}` : before}
      <mark className="global-search-mark">{selected}</mark>
      {after.length > 60 ? `${after.slice(0, 60)}…` : after}
    </span>
  );
}

export default function DocumentSearchDialog({
  locale,
  content,
  editable,
  initialReplace,
  initialQuery,
  onSelectLine,
  onReplaceContent,
  onClose,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(initialReplace);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(locale, key, vars);
  const matches = useMemo(
    () => collectDocumentMatches(content, query, caseSensitive, useRegex),
    [content, query, caseSensitive, useRegex],
  );
  const invalidRegex = useRegex && Boolean(query) && !isValidRegex(query);

  useModalEscape(true, onClose);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (initialReplace) setShowReplace(true);
  }, [initialReplace]);
  useEffect(() => setActiveIndex(0), [query, caseSensitive, useRegex]);
  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(Math.max(0, matches.length - 1));
  }, [activeIndex, matches.length]);
  useEffect(() => {
    const active = listRef.current?.querySelector(".global-search-item.active");
    if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex, matches]);

  const select = (index: number) => {
    const match = matches[index];
    if (!match) return;
    setActiveIndex(index);
    onSelectLine(match.line);
  };

  const openMatch = (index: number) => {
    select(index);
    onClose();
  };

  const replaceOne = () => {
    const match = matches[activeIndex];
    if (!editable || !match) return;
    onReplaceContent(`${content.slice(0, match.from)}${replacement}${content.slice(match.to)}`, match.line);
  };

  const replaceAll = () => {
    if (!editable || !query || !matches.length) return;
    try {
      const expression = new RegExp(useRegex ? query : escapeRegex(query), `${caseSensitive ? "" : "i"}g`);
      onReplaceContent(content.replace(expression, () => replacement), matches[0].line);
    } catch {
      /* invalid regular expression: the empty result state already communicates it */
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      inputRef.current?.focus();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {
      event.preventDefault();
      setShowReplace(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      openMatch(activeIndex);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal global-search-modal document-search-modal" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="global-search-header">
          <button
            type="button"
            className={`document-search-toggle${showReplace ? " active" : ""}`}
            title={tr("documentSearch.toggleReplace")}
            onClick={() => setShowReplace((value) => !value)}
          >
            ›
          </button>
          <input
            ref={inputRef}
            type="search"
            className="global-search-input"
            placeholder={tr("documentSearch.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="global-search-status">{tr("documentSearch.count", { n: matches.length })}</span>
          <button type="button" className="document-search-close" onClick={onClose} aria-label={tr("dialog.close")}>×</button>
        </div>
        {showReplace && (
          <div className="document-search-replace-row">
            <input
              type="text"
              className="global-search-input"
              placeholder={tr("documentSearch.replacePlaceholder")}
              value={replacement}
              disabled={!editable}
              onChange={(event) => setReplacement(event.target.value)}
            />
            <button type="button" className="btn-secondary btn-sm" disabled={!editable || !matches.length} onClick={replaceOne}>
              {tr("documentSearch.replace")}
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled={!editable || !matches.length} onClick={replaceAll}>
              {tr("documentSearch.replaceAll")}
            </button>
          </div>
        )}
        <div className="global-search-options">
          <label className="global-search-option">
            <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
            {tr("documentSearch.caseSensitive")}
          </label>
          <label className="global-search-option">
            <input type="checkbox" checked={useRegex} onChange={(event) => setUseRegex(event.target.checked)} />
            {tr("globalSearch.regex")}
          </label>
          {!editable && <span className="document-search-readonly">{tr("documentSearch.readOnly")}</span>}
        </div>
        <div className="global-search-body">
          {!query ? (
            <div className="global-search-hint">{tr("documentSearch.hint")}</div>
          ) : invalidRegex ? (
            <div className="global-search-empty global-search-error">{tr("globalSearch.invalidRegex")}</div>
          ) : matches.length === 0 ? (
            <div className="global-search-empty">{tr("globalSearch.noResults")}</div>
          ) : (
            <ul className="global-search-list" ref={listRef}>
              {matches.map((match, index) => (
                <li key={`${match.from}:${match.to}`}>
                  <button
                    type="button"
                    className={`global-search-item${index === activeIndex ? " active" : ""}`}
                    onClick={() => openMatch(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="global-search-line">{tr("status.line", { n: match.line })}</span>
                    <HighlightedLine match={match} />
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
