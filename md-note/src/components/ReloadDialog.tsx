interface Props {
  onReload: () => void;
  onDismiss: () => void;
}

export default function ReloadDialog({ onReload, onDismiss }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2>文件已更改</h2>
        </div>
        <div className="modal-body">
          <p className="modal-text">此文件已在外部被修改，是否重新加载？未保存的更改将丢失。</p>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onDismiss}>保留当前</button>
            <button className="btn-primary" onClick={onReload}>重新加载</button>
          </div>
        </div>
      </div>
    </div>
  );
}
