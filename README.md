<h1 align="center">InkNote</h1>

<p align="center"><strong>A local-first Markdown editor that feels like writing in a document.</strong></p>

<p align="center">
  English |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
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
  <a href="https://github.com/likehao19/InkNote/issues">Issues</a>
</p>

<p align="center">
  <img src="docs/assets/inknote-live-preview.png" alt="InkNote live preview with document outline" width="1000" />
</p>

## Markdown files, without the Markdown friction

InkNote keeps every document as a standard local Markdown file while giving you a polished writing surface. Formatting is rendered as you type, complex blocks can be edited in place, and the complete source is always one command away.

- **Local first** — no account, mandatory cloud, or document upload.
- **Portable by design** — plain `.md` files remain readable by any Markdown tool.
- **Safe to open** — every new or existing document exposes a clear **Preview / Edit** access switch.
- **Built for real documents** — outlines, workspaces, search, export, math, diagrams, tables, and code are part of the core workflow.

## Two ways to work

<table>
  <tr>
    <td width="50%"><img src="docs/assets/inknote-source-mode.png" alt="InkNote Markdown source mode" /></td>
    <td width="50%"><img src="docs/assets/inknote-settings.png" alt="InkNote appearance settings" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Live preview or full source</strong><br />Write with rendered formatting, or inspect and edit the complete Markdown source.</td>
    <td align="center"><strong>Your editor, your way</strong><br />Choose light, dark, or system appearance, Markdown themes, typography, and custom CSS.</td>
  </tr>
</table>

## What InkNote does

### Write and format

- Live-preview editing with Markdown syntax shown only when it is useful.
- Headings, lists, blockquotes, links, images, task lists, footnotes, and GFM tables.
- Formatting commands for bold, italic, strike-through, highlight, inline code, underline, superscript, and subscript.
- Focus mode and typewriter mode for distraction-free writing.

### Work with rich technical content

- Syntax-highlighted code blocks with line numbers and copy controls.
- KaTeX inline and block mathematics.
- Mermaid flowcharts, sequence diagrams, and other supported diagrams.
- In-place editors for tables, code, formulas, diagrams, images, and YAML front matter.

### Organize and find

- Multiple workspace folders, persistent file-tree state, and file operations.
- Document outline, recent files, and quick open.
- Find and replace in the current document.
- Workspace-wide filename and content search with result navigation.

### Publish and personalize

- Export complete documents to standalone HTML or PDF.
- Light, dark, and system UI appearance.
- GitHub, Vue, and Minimal Markdown themes, plus custom CSS.
- Markdown file associations, drag-and-drop opening, and in-app update checks.
- English and Simplified Chinese application interface.

## Download

| Platform | Package | Architecture |
| --- | --- | --- |
| Windows | [Installer](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Windows-x64-Setup.exe) | x64 |
| macOS | [Apple silicon DMG](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-arm64.dmg) | ARM64 |
| macOS | [Intel DMG](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-x86_64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.AppImage) · [DEB](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.deb) · [RPM](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.rpm) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.AppImage) · [DEB](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.deb) · [RPM](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.rpm) | ARM64 / aarch64 |

Release notes and older builds are available on [GitHub Releases](https://github.com/likehao19/InkNote/releases).

## Installation

### Windows

Download `InkNote-Windows-x64-Setup.exe` and follow the installer. The current Windows release supports x64 systems.

### macOS

Download the DMG for your Mac, open it, and drag **InkNote** into **Applications**.

InkNote is ad-hoc signed because the project does not currently use a paid Apple Developer certificate. If Gatekeeper blocks the first launch, open **System Settings → Privacy & Security** and choose **Open Anyway**. If macOS reports that the app is damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/InkNote.app
```

This removes the quarantine attribute from the downloaded app; it does not modify your documents.

### Linux

Check your architecture with `uname -m`: choose `x86_64` for 64-bit Intel/AMD systems or `arm64` for `aarch64` systems.

- Use **DEB** on Ubuntu, Debian, Linux Mint, Pop!_OS, and other Debian-based distributions.
- Use **RPM** on Fedora, RHEL, Rocky Linux, AlmaLinux, openSUSE, and other RPM-based distributions.
- Use **AppImage** on other mainstream glibc-based distributions. Alpine Linux and other musl-based systems are not currently supported.

```bash
# AppImage (replace x86_64 with arm64 when needed)
chmod +x InkNote-Linux-x86_64.AppImage
./InkNote-Linux-x86_64.AppImage

# Debian family
sudo apt install ./InkNote-Linux-x86_64.deb

# Fedora / RHEL family
sudo dnf install ./InkNote-Linux-x86_64.rpm

# openSUSE
sudo zypper install ./InkNote-Linux-x86_64.rpm
```

HTML export is available on Linux; PDF export is currently unavailable.

## Keyboard shortcuts

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

Open **Help → Keyboard Shortcuts** for the complete list.

## Privacy and local data

InkNote does not require an account and does not upload your documents. Files stay wherever you save them. Workspace folders, recent files, and preferences are stored locally in the platform application-data directory as `settings.json`.

## Build from source

### Requirements

- Node.js LTS and pnpm
- Rust stable
- [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/likehao19/InkNote.git
cd InkNote/InkNote
pnpm install
pnpm tauri dev
```

Run the project checks and create a desktop bundle with:

```bash
pnpm test
pnpm build
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## Technology

InkNote is built with Tauri 2 and Rust, React 19 and TypeScript, CodeMirror 6, unified/remark/rehype, KaTeX, Mermaid, and highlight.js.

## Contributing

Reproducible bug reports and focused feature requests are welcome in [GitHub Issues](https://github.com/likehao19/InkNote/issues). Before submitting code, run the frontend tests, production build, and Rust checks listed above.

Community discussion: [LinuxDo](https://linux.do)

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/likehao19">
        <img src="https://avatars.githubusercontent.com/u/96912988?v=4" width="72" height="72" alt="likehao19" /><br />
        <sub><strong>likehao19</strong></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/StackTao">
        <img src="https://avatars.githubusercontent.com/u/243470334?v=4" width="72" height="72" alt="StackTao" /><br />
        <sub><strong>StackTao</strong></sub>
      </a>
    </td>
  </tr>
</table>

## License

InkNote is open source under the [MIT License](LICENSE).
