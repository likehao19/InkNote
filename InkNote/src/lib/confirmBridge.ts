export type ConfirmHandler = (message: string) => Promise<boolean>;

let handler: ConfirmHandler | null = null;

export function setConfirmHandler(fn: ConfirmHandler | null) {
  handler = fn;
}

export async function askConfirm(message: string): Promise<boolean> {
  if (handler) return handler(message);
  return window.confirm(message);
}
