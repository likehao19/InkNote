import type { ReactNode } from "react";
import type { ThemePref } from "../lib/theme";
import { isMac } from "../lib/tauri";
import * as api from "../lib/tauri";
import { getCustomCssPath, setCustomCssPath } from "../lib/customTheme";

interface Props {
  onClose: () => void;
  theme: ThemePref;
  onTheme: (t: ThemePref) => void;
  fontSize: number;
  onFontSize: (n: number) => void;
  autosave: boolean;
  onAutosave: (b: boolean) => void;
  frontMatter: Record<string, string>;
  onFrontMatter: (data: Record<string, string>) => void;
}

export default function Settings({
  onClose,
  theme,
  onTheme,
  fontSize,
  onFontSize,
  autosave,
  onAutosave,
  frontMatter,
  onFrontMatter,
}: Props) {
  const customCss = getCustomCssPath();

  const pickCss = async () => {
    const p = await api.openCssDialog();
    if (p) setCustomCssPath(p);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <SettingRow label="主题">
            <select value={theme} onChange={(e) => onTheme(e.target.value as ThemePref)}>
              <option value="light">亮色</option>
              <option value="dark">暗色</option>
              <option value="system">跟随系统</option>
            </select>
          </SettingRow>

          <SettingRow label="编辑器字号">
            <input
              type="number"
              min={12}
              max={28}
              value={fontSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 12 && n <= 28) onFontSize(n);
              }}
            />
          </SettingRow>

          <SettingRow label="自动保存">
            <input type="checkbox" checked={autosave} onChange={(e) => onAutosave(e.target.checked)} />
          </SettingRow>

          <SettingRow label="自定义 CSS">
            <div className="setting-control">
              <button type="button" className="text-btn" onClick={pickCss}>选择 CSS 文件…</button>
              {customCss && (
                <button type="button" className="text-btn" onClick={() => setCustomCssPath(null)}>清除</button>
              )}
              {customCss && <div className="hint" title={customCss}>{customCss.split(/[\\/]/).pop()}</div>}
            </div>
          </SettingRow>

          {(
            <>
              <SettingRow label="YAML title">
                <input
                  type="text"
                  value={frontMatter.title ?? ""}
                  onChange={(e) => onFrontMatter({ ...frontMatter, title: e.target.value })}
                />
              </SettingRow>
              <SettingRow label="YAML author">
                <input
                  type="text"
                  value={frontMatter.author ?? ""}
                  onChange={(e) => onFrontMatter({ ...frontMatter, author: e.target.value })}
                />
              </SettingRow>
              <SettingRow label="YAML date">
                <input
                  type="text"
                  value={frontMatter.date ?? ""}
                  onChange={(e) => onFrontMatter({ ...frontMatter, date: e.target.value })}
                />
              </SettingRow>
            </>
          )}

          <SettingRow label="默认打开方式">
            <div className="hint">
              {isMac
                ? "在访达中右键 .md 文件 → 显示简介 → 打开方式，选择本应用并「全部更改」。"
                : "在「设置 → 应用 → 默认应用」中，将 .md 关联到本应用。"}
            </div>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-label">{label}</div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
