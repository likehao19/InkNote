import { t, type Locale } from "../lib/i18n";

export const SEARCH_PAGE_SIZE = 100;

export default function SearchResultPages({ locale, offset, total, onSelect }: {
  locale: Locale;
  offset: number;
  total: number;
  onSelect: (index: number) => void;
}) {
  if (total <= SEARCH_PAGE_SIZE) return null;
  return (
    <div className="search-result-pages">
      <button type="button" className="btn-secondary btn-sm" disabled={!offset}
        onClick={() => onSelect(offset - SEARCH_PAGE_SIZE)}>{t(locale, "search.previousPage")}</button>
      <span>{offset + 1}–{Math.min(offset + SEARCH_PAGE_SIZE, total)} / {total}</span>
      <button type="button" className="btn-secondary btn-sm" disabled={offset + SEARCH_PAGE_SIZE >= total}
        onClick={() => onSelect(offset + SEARCH_PAGE_SIZE)}>{t(locale, "search.nextPage")}</button>
    </div>
  );
}
