interface Props {
  title: string;
  label: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptDialog({ title, label, defaultValue = "", onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <div className="setting-row">
            <div className="setting-label">{label}</div>
            <div className="setting-control">
              <input
                type="text"
                defaultValue={defaultValue}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onConfirm((e.target as HTMLInputElement).value);
                  } else if (e.key === "Escape") {
                    onCancel();
                  }
                }}
                id="prompt-dialog-input"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const el = document.getElementById("prompt-dialog-input") as HTMLInputElement | null;
                onConfirm(el?.value ?? "");
              }}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
