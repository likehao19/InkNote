import type { Locale } from "./i18n";

/** CJK 统一表意文字及扩展 */
const CJK_RE =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;

/**
 * 混合中英文计数：每个 CJK 字符计 1 词，英文按空白分词。
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  let cjk = 0;
  for (const ch of trimmed) {
    if (CJK_RE.test(ch)) cjk++;
  }

  const latin = trimmed.replace(
    /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]+/g,
    " ",
  );
  const latinWords = latin.trim()
    ? latin.trim().split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  return cjk + latinWords;
}

export function estimateReadMinutes(words: number, locale: Locale): number {
  const wpm = locale === "zh" ? 400 : 200;
  return Math.max(1, Math.ceil(words / wpm));
}
