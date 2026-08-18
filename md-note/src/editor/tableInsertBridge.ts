let requestHandler: (() => void) | null = null;

export function setTableInsertRequestHandler(handler: (() => void) | null) {
  requestHandler = handler;
}

export function requestTableInsert(): boolean {
  if (!requestHandler) return false;
  requestHandler();
  return true;
}
