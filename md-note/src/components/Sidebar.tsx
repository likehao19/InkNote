import FileTree from "./FileTree";

export type SidebarTab = "files" | "outline" | "recent";

interface Props {
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  folderPath: string | null;
  dirTick?: number;
  onOpenPath: (path: string) => void;
  onRefreshTree?: () => void;
  onNewFileInDir?: (parentDir: string) => void;
  onNewFolderInDir?: (parentDir: string) => void;
  onRenamePath?: (path: string, isDir: boolean) => void;
  onDeletePath?: (path: string, isDir: boolean) => void;
  outline: { level: number; text: string; line: number }[];
  onOutlineClick: (line: number) => void;
  currentPath: string | null;
  recentFiles: string[];
}

export default function Sidebar({
  tab,
  onTab,
  folderPath,
  dirTick = 0,
  onOpenPath,
  onRefreshTree,
  onNewFileInDir,
  onNewFolderInDir,
  onRenamePath,
  onDeletePath,
  outline,
  onOutlineClick,
  currentPath,
  recentFiles,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={tab === "files" ? "tab active" : "tab"} onClick={() => onTab("files")}>文件</button>
        <button className={tab === "outline" ? "tab active" : "tab"} onClick={() => onTab("outline")}>大纲</button>
        <button className={tab === "recent" ? "tab active" : "tab"} onClick={() => onTab("recent")}>最近</button>
      </div>

      <div className="sidebar-body">
        {tab === "files" ? (
          <div className="file-panel">
            {!folderPath ? (
              <div className="empty">通过「文件 → 打开文件夹」浏览目录</div>
            ) : (
              <FileTree
                rootPath={folderPath}
                currentPath={currentPath}
                dirTick={dirTick}
                onOpenFile={onOpenPath}
                onRefresh={onRefreshTree ?? (() => {})}
                onNewFile={onNewFileInDir ?? (() => {})}
                onNewFolder={onNewFolderInDir ?? (() => {})}
                onRename={onRenamePath ?? (() => {})}
                onDelete={onDeletePath ?? (() => {})}
              />
            )}
          </div>
        ) : tab === "outline" ? (
          <div className="outline-panel">
            {outline.length === 0 ? (
              <div className="empty">无标题</div>
            ) : (
              <ul className="outline-list">
                {outline.map((h, i) => (
                  <li
                    key={i}
                    className="outline-item"
                    style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
                    onClick={() => onOutlineClick(h.line)}
                  >
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="recent-panel">
            {recentFiles.length === 0 ? (
              <div className="empty">暂无最近文件</div>
            ) : (
              <ul className="file-list">
                {recentFiles.map((p) => {
                  const name = p.split(/[\\/]/).pop() || p;
                  const active = currentPath === p;
                  return (
                    <li
                      key={p}
                      className={active ? "file-item active" : "file-item"}
                      onClick={() => onOpenPath(p)}
                      title={p}
                    >
                      <span className="file-name">{name}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
