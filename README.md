<h1 align="center">InkNote</h1>

<p align="center">A local-first, WYSIWYG Markdown editor for Windows and macOS.</p>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/InkNote/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/InkNote?display_name=tag&sort=semver" alt="Latest release" /></a>
  <a href="https://github.com/likehao19/InkNote/actions/workflows/ci.yml"><img src="https://github.com/likehao19/InkNote/actions/workflows/ci.yml/badge.svg" alt="Build status" /></a>
  <a href="https://github.com/likehao19/InkNote/releases"><img src="https://img.shields.io/github/downloads/likehao19/InkNote/total" alt="Downloads" /></a>
  <a href="https://github.com/likehao19/InkNote/stargazers"><img src="https://img.shields.io/github/stars/likehao19/InkNote?style=flat&logo=github" alt="GitHub stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://likehao19.github.io/InkNote/">Website</a> ·
  <a href="https://github.com/likehao19/InkNote/releases/latest">Download</a> ·
  <a href="https://github.com/likehao19/InkNote/issues">Report an issue</a>
</p>

<p align="center">
  <img src="docs/assets/inknote-website-preview.svg" alt="InkNote editor" width="900" />
</p>

## Why InkNote?

InkNote combines a polished writing surface with ordinary Markdown files. It renders formatting as you write, lets you edit rich blocks in place, and always keeps the source portable and readable by other Markdown tools.

- **Local first** — no account, no mandatory cloud, and no document uploads.
- **Standard Markdown** — your notes remain plain `.md` files that you control.
- **Focused editing** — switch between read-only preview, live editing, and full source mode.
- **Cross-platform** — native desktop packages for Windows, Intel Mac, and Apple silicon Mac.

## Features

- **Seamless live preview** — edit content directly while Markdown syntax stays out of the way.
- **Markdown and GFM** — headings, lists, blockquotes, tables, tasks, footnotes, links, and more.
- **Rich technical writing** — syntax-highlighted code blocks, KaTeX math, and Mermaid diagrams.
- **Direct block editing** — edit tables, code, formulas, diagrams, images, and front matter in place.
- **Workspace tools** — multiple folders, file tree, document outline, recent files, and quick open.
- **Search** — find and replace in the current document or search across a workspace.
- **Writing modes** — preview/edit access, live preview/source, focus mode, and typewriter mode.
- **Export** — create standalone HTML and PDF documents.
- **Personalization** — light/dark UI, Markdown themes, typography controls, and custom CSS.
- **Desktop integration** — Markdown file associations, drag and drop, and in-app updates.
- **Bilingual interface** — English and Simplified Chinese.

## Download

| Platform | Package | Architecture |
| --- | --- | --- |
| Windows | [Download the installer](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Windows-x64-Setup.exe) | x64 |
| macOS | [Download for Apple silicon](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-arm64.dmg) | ARM64 |
| macOS | [Download for Intel](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-x86_64.dmg) | x86_64 |

Previous versions and release notes are available on the [Releases](https://github.com/likehao19/InkNote/releases) page.

## Install

### Windows

Download `InkNote-Windows-x64-Setup.exe` and follow the installer. InkNote currently provides an x64 Windows build.

### macOS

Download the DMG for your Mac, open it, and drag **InkNote** into **Applications**.

The macOS package is ad-hoc signed and is not notarized by Apple. If Gatekeeper blocks the first launch, open **System Settings → Privacy & Security** and choose **Open Anyway**. If macOS still reports that the app is damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/InkNote.app
```

## Keyboard Shortcuts

| Action | Windows | macOS |
| --- | --- | --- |
| New document | `Ctrl+N` | `⌘N` |
| Open file | `Ctrl+O` | `⌘O` |
| Save | `Ctrl+S` | `⌘S` |
| Find / replace | `Ctrl+F` | `⌘F` |
| Search workspace | `Ctrl+Shift+F` | `⌘⇧F` |
| Quick open | `Ctrl+P` | `⌘P` |
| Live preview / source | `Ctrl+/` | `⌘/` |
| Toggle sidebar | `Ctrl+Shift+L` | `⌘⇧L` |
| Settings | `Ctrl+,` | `⌘,` |
| Focus mode | `F8` | `F8` |
| Typewriter mode | `F9` | `F9` |

Open **Help → Keyboard Shortcuts** in InkNote for the complete list.

## Privacy and Local Data

InkNote does not require an account and does not upload your documents. Markdown files stay wherever you save them. Workspace folders, recent files, and preferences are stored locally in the platform-specific application data directory as `settings.json`.

## FAQ

### Does InkNote use a proprietary document format?

No. InkNote reads and writes standard Markdown files, so you can open the same documents in any compatible editor.

### Can I use InkNote without a workspace?

Yes. You can open or create individual Markdown files, or add one or more folders when you want file-tree navigation and workspace search.

### Why does macOS warn when I open InkNote?

InkNote does not currently use a paid Apple Developer certificate or Apple notarization. The release is ad-hoc signed to protect bundle integrity, but Gatekeeper may still require one-time approval as described in the [macOS installation steps](#macos).

### How do updates work?

Use **Help → Check for Updates**. InkNote reads the latest GitHub Release and selects the correct package for Windows, Intel Mac, or Apple silicon Mac.

## Development

### Prerequisites

- Node.js LTS and pnpm
- Rust stable
- The [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)

### Run locally

```bash
git clone https://github.com/likehao19/InkNote.git
cd InkNote/InkNote
pnpm install
pnpm tauri dev
```

### Validate and build

```bash
pnpm test
pnpm build
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## Project Structure

```text
InkNote/
├─ .github/workflows/   # CI, release, and website deployment
├─ docs/                # GitHub Pages website
├─ InkNote/
│  ├─ src/              # React UI and CodeMirror editor
│  ├─ src-tauri/        # Tauri and Rust desktop backend
│  └─ public/           # Application assets
└─ README.md
```

## Technology

- Tauri 2 and Rust
- React 19, TypeScript, and Vite
- CodeMirror 6
- unified, remark, and rehype
- KaTeX, Mermaid, and highlight.js

## Contributing

Bug reports and focused feature requests are welcome in [GitHub Issues](https://github.com/likehao19/InkNote/issues). Before submitting code, run the frontend tests, production build, and Rust checks described above.

## Community

- [LinuxDo](https://linux.do)

## License

InkNote is available under the [MIT License](LICENSE).
