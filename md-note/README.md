# 墨笺 InkNote

类 Typora 的本地 Markdown 编辑器，基于 **Tauri 2** + **React** + **CodeMirror 6** 构建。

## 特性

- 无缝实时预览（WYSIWYG）
- 源码 / 预览模式切换（`Ctrl+/`）
- 数学公式（KaTeX）、Mermaid 图表
- 表格编辑、任务列表、YAML Front Matter
- 文件树、大纲、最近文件
- 导出 HTML / PDF
- 专注模式（F8）、打字机模式（F9）
- 亮色 / 暗色主题与自定义 CSS

## 开发

```bash
cd md-note
pnpm install
pnpm tauri dev
```

## 构建

```bash
pnpm tauri build
```

## 定位说明

墨笺 InkNote 专注**本地单文件 Markdown 写作**，不做云端同步、双链图谱或插件市场。目标是轻量、快速、类 Typora 的书写体验。

## 许可证

Private project.
