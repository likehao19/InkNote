import { useCallback, useEffect, useRef, useState } from "react";
import { formatError } from "./errors";

const DISMISS_MS = 4200;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setMessage(null);
  }, []);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, DISMISS_MS);
    },
    [dismiss],
  );

  const showError = useCallback(
    (e: unknown) => {
      show(formatError(e));
    },
    [show],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { message, show, showError, dismiss };
}
