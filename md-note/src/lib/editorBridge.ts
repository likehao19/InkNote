export type PromptRequest = {
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
};

export type EditorBridgeHandlers = {
  confirm: (message: string) => Promise<boolean>;
  prompt: (req: PromptRequest) => Promise<string | null>;
  pickLink: (defaultText: string) => Promise<{ text: string; url: string } | null>;
  pickImage: (defaultAlt: string) => Promise<{ alt: string; path: string } | null>;
  requestSave: () => Promise<string | null>;
  showError: (e: unknown) => void;
  showMessage: (message: string) => void;
};

let handlers: EditorBridgeHandlers | null = null;

export function setEditorBridge(h: EditorBridgeHandlers | null) {
  handlers = h;
}

export async function editorConfirm(message: string): Promise<boolean> {
  if (handlers) return handlers.confirm(message);
  return window.confirm(message);
}

export async function editorPrompt(req: PromptRequest): Promise<string | null> {
  if (handlers) return handlers.prompt(req);
  const v = window.prompt(req.label, req.defaultValue ?? "");
  return v === null ? null : v;
}

export async function editorPickLink(defaultText: string): Promise<{ text: string; url: string } | null> {
  if (handlers) return handlers.pickLink(defaultText);
  const url = window.prompt("URL", "https://");
  if (!url) return null;
  const text = defaultText || window.prompt("Text", "") || url;
  return { text, url };
}

export async function editorPickImage(defaultAlt: string): Promise<{ alt: string; path: string } | null> {
  if (handlers) return handlers.pickImage(defaultAlt);
  const path = window.prompt("Image path", "");
  if (!path) return null;
  return { alt: defaultAlt, path };
}

export async function editorRequestSave(): Promise<string | null> {
  if (handlers) return handlers.requestSave();
  return null;
}

export function editorShowError(e: unknown): void {
  if (handlers) handlers.showError(e);
}

export function editorShowMessage(message: string): void {
  if (handlers) handlers.showMessage(message);
}
