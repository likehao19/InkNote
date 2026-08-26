export function nextUpdatePercent(
  downloaded: number,
  total: number,
  previous: number,
): number {
  if (!Number.isFinite(downloaded) || !Number.isFinite(total) || total <= 0) {
    return previous;
  }
  const current = Math.round((downloaded / total) * 100);
  return Math.max(previous, Math.min(100, Math.max(0, current)));
}
