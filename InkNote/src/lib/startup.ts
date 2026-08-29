/** Run non-critical startup work after the first render, with a bounded fallback. */
export function scheduleIdleTask(task: () => void, timeout = 2_000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(task, 0);
  return () => window.clearTimeout(id);
}
