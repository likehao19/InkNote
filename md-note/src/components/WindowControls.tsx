import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isMac } from "../lib/tauri";

function useMaximized() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const un = win.onResized(() => {
      win.isMaximized().then(setMaximized);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  return maximized;
}

function MacControls() {
  const win = getCurrentWindow();
  return (
    <div className="window-controls mac" data-tauri-drag-region={false}>
      <button
        type="button"
        className="wc-btn wc-close"
        title="关闭"
        aria-label="关闭"
        onClick={() => win.close()}
      />
      <button
        type="button"
        className="wc-btn wc-minimize"
        title="最小化"
        aria-label="最小化"
        onClick={() => win.minimize()}
      />
      <button
        type="button"
        className="wc-btn wc-maximize"
        title="最大化"
        aria-label="最大化"
        onClick={() => win.toggleMaximize()}
      />
    </div>
  );
}

function WinControls() {
  const win = getCurrentWindow();
  const maximized = useMaximized();

  return (
    <div className="window-controls win" data-tauri-drag-region={false}>
      <button
        type="button"
        className="wc-btn wc-minimize"
        title="最小化"
        aria-label="最小化"
        onClick={() => win.minimize()}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className="wc-btn wc-maximize"
        title={maximized ? "还原" : "最大化"}
        aria-label={maximized ? "还原" : "最大化"}
        onClick={() => win.toggleMaximize()}
      >
        {maximized ? (
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path
              d="M3 3h6v6H3V3zm1 1v4h4V4H4zM5 1h6v6h-1V2H5V1z"
              fill="currentColor"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="wc-btn wc-close"
        title="关闭"
        aria-label="关闭"
        onClick={() => win.close()}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
}

export default function WindowControls() {
  return isMac ? <MacControls /> : <WinControls />;
}
