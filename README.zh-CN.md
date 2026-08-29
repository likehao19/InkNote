<h1 align="center">墨笺 InkNote</h1>

<p align="center">一款面向 Windows 与 macOS、本地优先、所见即所得的 Markdown 编辑器。</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

<p align="center">
  <a href="https://github.com/likehao19/InkNote/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/InkNote?display_name=tag&sort=semver" alt="最新版本" /></a>
  <a href="https://github.com/likehao19/InkNote/actions/workflows/ci.yml"><img src="https://github.com/likehao19/InkNote/actions/workflows/ci.yml/badge.svg" alt="构建状态" /></a>
  <a href="https://github.com/likehao19/InkNote/releases"><img src="https://img.shields.io/github/downloads/likehao19/InkNote/total" alt="下载量" /></a>
  <a href="https://github.com/likehao19/InkNote/stargazers"><img src="https://img.shields.io/github/stars/likehao19/InkNote?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT 许可证" /></a>
</p>

<p align="center">
  <a href="https://likehao19.github.io/InkNote/">官方网站</a> ·
  <a href="https://github.com/likehao19/InkNote/releases/latest">下载</a> ·
  <a href="https://github.com/likehao19/InkNote/issues">问题反馈</a>
</p>

<p align="center">
  <img src="docs/assets/inknote-website-preview.svg" alt="墨笺 InkNote 编辑器" width="900" />
</p>

## 为什么选择 InkNote？

InkNote 将舒适的写作界面与普通 Markdown 文件结合起来。它会在输入时实时排版，支持直接编辑复杂内容块，同时始终保留可移植、可由其他 Markdown 工具读取的源文件。

- **本地优先**：无需账号、不强制使用云服务，也不会上传文档。
- **标准 Markdown**：笔记始终是由你掌控的普通 `.md` 文件。
- **专注写作**：可以在只读预览、实时编辑和完整源码模式之间切换。
- **跨平台**：提供 Windows、Intel Mac 和 Apple 芯片 Mac 的桌面安装包。

## 主要功能

- **无缝实时预览**：直接编辑内容，Markdown 标记在不需要时自动隐藏。
- **Markdown 与 GFM**：支持标题、列表、引用、表格、任务、脚注、链接等常用语法。
- **技术写作**：支持代码语法高亮、KaTeX 数学公式和 Mermaid 图表。
- **内容块原位编辑**：直接编辑表格、代码、公式、图表、图片和 front matter。
- **工作区工具**：多根目录、文件树、文档大纲、最近文件和快速打开。
- **搜索**：当前文档查找替换，以及跨工作区全文搜索。
- **多种写作模式**：预览/编辑、实时预览/源码、专注模式和打字机模式。
- **导出**：生成独立 HTML 和 PDF 文档。
- **个性化**：亮色/暗色界面、Markdown 主题、排版控制和自定义 CSS。
- **桌面集成**：Markdown 文件关联、拖放打开和应用内更新。
- **双语界面**：支持简体中文和英文。

## 下载

| 平台 | 安装包 | 架构 |
| --- | --- | --- |
| Windows | [下载安装程序](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Windows-x64-Setup.exe) | x64 |
| macOS | [下载 Apple 芯片版本](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-arm64.dmg) | ARM64 |
| macOS | [下载 Intel 版本](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-x86_64.dmg) | x86_64 |

历史版本和更新说明可以在 [Releases](https://github.com/likehao19/InkNote/releases) 页面查看。

## 安装

### Windows

下载 `InkNote-Windows-x64-Setup.exe` 并按照安装程序提示操作。InkNote 当前提供 Windows x64 版本。

### macOS

根据 Mac 处理器下载对应 DMG，打开后将 **InkNote** 拖入 **应用程序** 文件夹。

macOS 安装包使用 ad-hoc 签名，尚未经过 Apple 公证。如果 Gatekeeper 在首次启动时拦截，请打开 **系统设置 → 隐私与安全性**，选择 **仍要打开**。如果系统仍提示应用已损坏，请执行：

```bash
xattr -dr com.apple.quarantine /Applications/InkNote.app
```

## 常用快捷键

| 功能 | Windows | macOS |
| --- | --- | --- |
| 新建文档 | `Ctrl+N` | `⌘N` |
| 打开文件 | `Ctrl+O` | `⌘O` |
| 保存 | `Ctrl+S` | `⌘S` |
| 当前文档查找/替换 | `Ctrl+F` | `⌘F` |
| 工作区搜索 | `Ctrl+Shift+F` | `⌘⇧F` |
| 快速打开 | `Ctrl+P` | `⌘P` |
| 实时预览/源码 | `Ctrl+/` | `⌘/` |
| 切换侧边栏 | `Ctrl+Shift+L` | `⌘⇧L` |
| 设置 | `Ctrl+,` | `⌘,` |
| 专注模式 | `F8` | `F8` |
| 打字机模式 | `F9` | `F9` |

完整列表可以在 InkNote 的 **帮助 → 快捷键** 中查看。

## 隐私与本地数据

InkNote 不要求账号，也不会上传文档。Markdown 文件保存在你选择的位置；工作区目录、最近文件和偏好设置会作为 `settings.json` 保存在各系统对应的应用数据目录中。

## 常见问题

### InkNote 会使用专有文档格式吗？

不会。InkNote 读写标准 Markdown 文件，你可以使用任何兼容编辑器打开同一份文档。

### 不打开工作区也能使用吗？

可以。你可以单独创建或打开 Markdown 文件；需要文件树和工作区搜索时，再添加一个或多个文件夹。

### 为什么 macOS 首次打开时会警告？

InkNote 目前没有使用付费 Apple Developer 证书，也没有经过 Apple 公证。发布包已经通过 ad-hoc 签名保证应用结构完整，但 Gatekeeper 仍可能要求一次性确认，处理方法请参考 [macOS 安装步骤](#macos)。

### 如何更新 InkNote？

使用 **帮助 → 检查更新**。InkNote 会读取最新 GitHub Release，并自动选择 Windows、Intel Mac 或 Apple 芯片 Mac 对应的更新包。

## 开发

### 环境要求

- Node.js LTS 与 pnpm
- Rust stable
- [Tauri 2 平台依赖](https://v2.tauri.app/start/prerequisites/)

### 本地运行

```bash
git clone https://github.com/likehao19/InkNote.git
cd InkNote/InkNote
pnpm install
pnpm tauri dev
```

### 验证与构建

```bash
pnpm test
pnpm build
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## 项目结构

```text
InkNote/
├─ .github/workflows/   # 持续集成、发布和官网部署
├─ docs/                # GitHub Pages 官网
├─ InkNote/
│  ├─ src/              # React 界面与 CodeMirror 编辑器
│  ├─ src-tauri/        # Tauri 与 Rust 桌面后端
│  └─ public/           # 应用静态资源
└─ README.md
```

## 技术栈

- Tauri 2 与 Rust
- React 19、TypeScript 与 Vite
- CodeMirror 6
- unified、remark 与 rehype
- KaTeX、Mermaid 与 highlight.js

## 参与贡献

欢迎通过 [GitHub Issues](https://github.com/likehao19/InkNote/issues) 提交可复现的问题或聚焦的功能建议。提交代码前，请运行上述前端测试、生产构建和 Rust 检查。

## 交流社区

- [LinuxDo](https://linux.do)

## 许可证

InkNote 基于 [MIT 许可证](LICENSE) 开源。
