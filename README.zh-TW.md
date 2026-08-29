<h1 align="center">墨箋 InkNote</h1>

<p align="center"><strong>本機優先，像編輯一般文件一樣撰寫 Markdown。</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  繁體中文 |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/InkNote/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/InkNote?display_name=tag&sort=semver" alt="最新版本" /></a>
  <a href="https://github.com/likehao19/InkNote/actions/workflows/ci.yml"><img src="https://github.com/likehao19/InkNote/actions/workflows/ci.yml/badge.svg" alt="建置狀態" /></a>
  <a href="https://github.com/likehao19/InkNote/releases"><img src="https://img.shields.io/github/downloads/likehao19/InkNote/total" alt="下載次數" /></a>
  <a href="https://github.com/likehao19/InkNote/stargazers"><img src="https://img.shields.io/github/stars/likehao19/InkNote?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT 授權條款" /></a>
</p>

<p align="center">
  <a href="https://likehao19.github.io/InkNote/">官方網站</a> ·
  <a href="https://github.com/likehao19/InkNote/releases/latest">下載</a> ·
  <a href="https://github.com/likehao19/InkNote/issues">問題回報</a>
</p>

<p align="center">
  <img src="docs/assets/inknote-live-preview.png" alt="墨箋即時預覽與文件大綱" width="1000" />
</p>

## 保留 Markdown 檔案，減少 Markdown 的干擾

InkNote 始終以標準 Markdown 檔案儲存文件，同時提供接近一般文件編輯器的撰寫體驗。輸入時直接看到排版結果，複雜內容區塊可就地編輯，需要時也能隨時切換到完整原始碼。

- **本機優先**：不需要帳號、不強制使用雲端服務，也不會上傳文件。
- **開放格式**：筆記始終是普通 `.md` 檔案，可由任何 Markdown 工具讀取。
- **安心開啟**：新建和現有文件都會顯示清楚的 **預覽 / 編輯** 存取切換，避免誤改檔案。
- **面向真實文件**：大綱、工作區、搜尋、匯出、公式、圖表、表格與程式碼都整合在核心流程中。

## 兩種撰寫方式

<table>
  <tr>
    <td width="50%"><img src="docs/assets/inknote-source-mode.png" alt="墨箋 Markdown 原始碼模式" /></td>
    <td width="50%"><img src="docs/assets/inknote-settings.png" alt="墨箋外觀設定" /></td>
  </tr>
  <tr>
    <td align="center"><strong>即時預覽或完整原始碼</strong><br />在排版後的內容中撰寫，或直接檢查與編輯完整 Markdown 原始碼。</td>
    <td align="center"><strong>依照自己的方式使用</strong><br />選擇淺色、深色或跟隨系統，以及 Markdown 主題、排版與自訂 CSS。</td>
  </tr>
</table>

## InkNote 能做什麼

### 撰寫與排版

- 即時預覽編輯，只在需要時顯示 Markdown 標記。
- 支援標題、清單、引用、連結、圖片、工作清單、註腳與 GFM 表格。
- 支援粗體、斜體、刪除線、螢光標示、行內程式碼、底線、上標與下標。
- 提供專注模式與打字機模式，減少撰寫干擾。

### 技術內容

- 具備語法醒目提示、行號與複製按鈕的程式碼區塊。
- KaTeX 行內與區塊數學公式。
- Mermaid 流程圖、循序圖及其他支援的圖表。
- 表格、程式碼、公式、圖表、圖片與 YAML front matter 均可就地編輯。

### 整理與搜尋

- 多個工作區資料夾、檔案樹狀態保存及常用檔案操作。
- 文件大綱、最近檔案與快速開啟。
- 目前文件的尋找與取代。
- 跨工作區搜尋檔名與內容，並直接跳至結果。

### 匯出與個人化

- 將完整文件匯出為獨立 HTML 或 PDF。
- 淺色、深色與跟隨系統的介面外觀。
- GitHub、Vue、極簡 Markdown 主題，以及自訂 CSS。
- Markdown 檔案關聯、拖放開啟與應用程式內更新檢查。
- 應用程式介面支援簡體中文與英文。

## 下載

| 平台 | 安裝套件 | 架構 |
| --- | --- | --- |
| Windows | [下載安裝程式](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Windows-x64-Setup.exe) | x64 |
| macOS | [下載 Apple 晶片版](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-arm64.dmg) | ARM64 |
| macOS | [下載 Intel 版](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-x86_64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.AppImage) · [DEB](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.deb) · [RPM](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.rpm) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.AppImage) · [DEB](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.deb) · [RPM](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.rpm) | ARM64 / aarch64 |

版本說明與舊版可在 [GitHub Releases](https://github.com/likehao19/InkNote/releases) 查看。

## 安裝

### Windows

下載 `InkNote-Windows-x64-Setup.exe` 並依照安裝程式操作。目前 Windows 版本支援 x64 系統。

### macOS

依照 Mac 處理器下載對應的 DMG，開啟後將 **InkNote** 拖入 **應用程式** 資料夾。

專案目前未使用付費 Apple Developer 憑證，因此安裝套件採用 ad-hoc 簽署。如果 Gatekeeper 在首次啟動時阻擋，請開啟 **系統設定 → 隱私權與安全性** 並選擇 **仍要打開**。如果 macOS 仍顯示應用程式已損毀，請執行：

```bash
xattr -dr com.apple.quarantine /Applications/InkNote.app
```

此命令只會移除下載應用程式的隔離屬性，不會修改你的文件。

### Linux

先執行 `uname -m` 查看架構：64 位元 Intel/AMD 裝置選擇 `x86_64`，顯示 `aarch64` 的裝置選擇 `arm64`。

- Ubuntu、Debian、Linux Mint、Pop!_OS 等 Debian 系發行版使用 **DEB**。
- Fedora、RHEL、Rocky Linux、AlmaLinux、openSUSE 等 RPM 系發行版使用 **RPM**。
- 其他主流、以 glibc 為基礎的發行版可使用 **AppImage**。目前不支援 Alpine Linux 等以 musl 為基礎的系統。

```bash
# AppImage（ARM64 裝置請將 x86_64 替換為 arm64）
chmod +x InkNote-Linux-x86_64.AppImage
./InkNote-Linux-x86_64.AppImage

# Debian 系
sudo apt install ./InkNote-Linux-x86_64.deb

# Fedora / RHEL 系
sudo dnf install ./InkNote-Linux-x86_64.rpm

# openSUSE
sudo zypper install ./InkNote-Linux-x86_64.rpm
```

Linux 版支援匯出 HTML，目前尚不支援匯出 PDF。

## 常用快速鍵

| 功能 | Windows | macOS |
| --- | --- | --- |
| 新增文件 | `Ctrl+N` | `⌘N` |
| 開啟檔案 | `Ctrl+O` | `⌘O` |
| 儲存 | `Ctrl+S` | `⌘S` |
| 尋找 / 取代 | `Ctrl+F` | `⌘F` |
| 搜尋工作區 | `Ctrl+Shift+F` | `⌘⇧F` |
| 快速開啟 | `Ctrl+P` | `⌘P` |
| 即時預覽 / 原始碼 | `Ctrl+/` | `⌘/` |
| 切換側邊欄 | `Ctrl+Shift+L` | `⌘⇧L` |
| 設定 | `Ctrl+,` | `⌘,` |
| 專注模式 | `F8` | `F8` |
| 打字機模式 | `F9` | `F9` |

在 InkNote 中開啟 **說明 → 鍵盤快速鍵** 可查看完整清單。

## 隱私權與本機資料

InkNote 不要求登入，也不會上傳文件。檔案保存在你選擇的位置；工作區資料夾、最近檔案與偏好設定會以 `settings.json` 儲存在系統對應的應用程式資料目錄。

## 從原始碼建置

### 環境需求

- Node.js LTS 與 pnpm
- Rust stable
- [Tauri 2 平台相依套件](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/likehao19/InkNote.git
cd InkNote/InkNote
pnpm install
pnpm tauri dev
```

執行專案檢查並建立桌面安裝套件：

```bash
pnpm test
pnpm build
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## 技術

InkNote 使用 Tauri 2 與 Rust、React 19 與 TypeScript、CodeMirror 6、unified/remark/rehype、KaTeX、Mermaid 和 highlight.js 建置。

## 參與貢獻

歡迎透過 [GitHub Issues](https://github.com/likehao19/InkNote/issues) 提交可重現的問題或聚焦的功能建議。社群交流：[LinuxDo](https://linux.do)

## 貢獻者

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

## 授權條款

InkNote 依照 [MIT License](LICENSE) 開放原始碼。
