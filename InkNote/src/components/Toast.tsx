import type { ToastKind } from "../lib/useToast";

interface Props {
  message: string | null;
  kind?: ToastKind;
}

export default function Toast({ message, kind = "info" }: Props) {
  if (!message) return null;
  return (
    <div className={`toast toast-${kind}`} role="alert">
      {message}
    </div>
  );
}
