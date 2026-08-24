import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.sessionRecovery";

export interface SessionRecoverySnapshot {
  path: string | null;
  content: string;
  diskContent: string;
  dirty: boolean;
  time: number;
}

export function stashSessionRecovery(snap: SessionRecoverySnapshot) {
  try {
    setStoredValue(KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

export function getSessionRecovery(): SessionRecoverySnapshot | null {
  try {
    const raw = getStoredValue(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionRecoverySnapshot;
  } catch {
    return null;
  }
}

export function clearSessionRecovery() {
  removeStoredValue(KEY);
}
