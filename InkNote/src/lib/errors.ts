/** 从 invoke / Error / 字符串中提取用户可读错误信息 */
export function formatError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}
