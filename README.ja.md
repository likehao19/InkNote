<h1 align="center">InkNote</h1>

<p align="center"><strong>ローカルファースト。普通の文書を書くように使える Markdown エディター。</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  日本語 |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/InkNote/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/InkNote?display_name=tag&sort=semver" alt="最新リリース" /></a>
  <a href="https://github.com/likehao19/InkNote/actions/workflows/ci.yml"><img src="https://github.com/likehao19/InkNote/actions/workflows/ci.yml/badge.svg" alt="ビルド状況" /></a>
  <a href="https://github.com/likehao19/InkNote/releases"><img src="https://img.shields.io/github/downloads/likehao19/InkNote/total" alt="ダウンロード数" /></a>
  <a href="https://github.com/likehao19/InkNote/stargazers"><img src="https://img.shields.io/github/stars/likehao19/InkNote?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://likehao19.github.io/InkNote/">Web サイト</a> ·
  <a href="https://github.com/likehao19/InkNote/releases/latest">ダウンロード</a> ·
  <a href="https://github.com/likehao19/InkNote/issues">Issue</a>
</p>

<p align="center">
  <img src="docs/assets/inknote-live-preview.png" alt="InkNote のライブプレビューと文書アウトライン" width="1000" />
</p>

## Markdown ファイルはそのまま、記法のわずらわしさは少なく

InkNote は文書を標準のローカル Markdown ファイルとして保存しながら、一般的な文書エディターに近い執筆体験を提供します。入力中に整形結果を確認でき、複雑なブロックはその場で編集でき、必要なときはいつでも完全なソースへ切り替えられます。

- **ローカルファースト**：アカウントも必須クラウドも文書アップロードも不要です。
- **高い可搬性**：通常の `.md` ファイルなので、ほかの Markdown ツールでも開けます。
- **安全に開く**：新規・既存のすべての文書に **プレビュー / 編集** アクセス切り替えを表示し、意図しない変更を防ぎます。
- **実用的な文書向け**：アウトライン、ワークスペース、検索、エクスポート、数式、図表、テーブル、コードを一つの流れで扱えます。

## 2 つの編集スタイル

<table>
  <tr>
    <td width="50%"><img src="docs/assets/inknote-source-mode.png" alt="InkNote の Markdown ソースモード" /></td>
    <td width="50%"><img src="docs/assets/inknote-settings.png" alt="InkNote の外観設定" /></td>
  </tr>
  <tr>
    <td align="center"><strong>ライブプレビューと完全なソース</strong><br />整形済みの文書を直接編集することも、Markdown ソース全体を確認・編集することもできます。</td>
    <td align="center"><strong>自分に合うエディター</strong><br />ライト、ダーク、システム連動、Markdown テーマ、文字組み、カスタム CSS を選べます。</td>
  </tr>
</table>

## 主な機能

### 執筆と書式

- 必要なときだけ Markdown 記法を見せるライブプレビュー編集。
- 見出し、リスト、引用、リンク、画像、タスクリスト、脚注、GFM テーブル。
- 太字、斜体、取り消し線、ハイライト、インラインコード、下線、上付き・下付き文字。
- 集中モードとタイプライターモード。

### 技術文書

- シンタックスハイライト、行番号、コピーボタン付きコードブロック。
- KaTeX のインライン数式とブロック数式。
- Mermaid のフローチャート、シーケンス図など。
- テーブル、コード、数式、図、画像、YAML front matter のインプレース編集。

### 整理と検索

- 複数のワークスペースフォルダー、ファイルツリー状態の保持、ファイル操作。
- 文書アウトライン、最近使ったファイル、クイックオープン。
- 現在の文書内での検索と置換。
- ファイル名と内容を対象にしたワークスペース横断検索と結果への移動。

### 出力とカスタマイズ

- 文書全体を単体の HTML または PDF としてエクスポート。
- ライト、ダーク、システム連動の外観。
- GitHub、Vue、Minimal の Markdown テーマとカスタム CSS。
- Markdown ファイル関連付け、ドラッグ＆ドロップ、アプリ内アップデート確認。
- アプリ UI は英語と簡体字中国語に対応。

## ダウンロード

| プラットフォーム | パッケージ | アーキテクチャ |
| --- | --- | --- |
| Windows | [インストーラー](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Windows-x64-Setup.exe) | x64 |
| macOS | [Apple シリコン版 DMG](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-arm64.dmg) | ARM64 |
| macOS | [Intel 版 DMG](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-x86_64.dmg) | x86_64 |

リリースノートと過去のビルドは [GitHub Releases](https://github.com/likehao19/InkNote/releases) で確認できます。

## インストール

### Windows

`InkNote-Windows-x64-Setup.exe` をダウンロードし、インストーラーの案内に従ってください。現在の Windows 版は x64 に対応しています。

### macOS

Mac に合う DMG を開き、**InkNote** を **Applications** フォルダーへドラッグします。

現在、このプロジェクトは有料の Apple Developer 証明書を使用していないため、アプリは ad-hoc 署名されています。初回起動を Gatekeeper に止められた場合は、**システム設定 → プライバシーとセキュリティ** から **このまま開く** を選んでください。「アプリが壊れています」と表示される場合は、次を実行します。

```bash
xattr -dr com.apple.quarantine /Applications/InkNote.app
```

このコマンドはダウンロードしたアプリの隔離属性だけを削除し、文書には変更を加えません。

## キーボードショートカット

| 操作 | Windows | macOS |
| --- | --- | --- |
| 新規文書 | `Ctrl+N` | `⌘N` |
| ファイルを開く | `Ctrl+O` | `⌘O` |
| 保存 | `Ctrl+S` | `⌘S` |
| 検索 / 置換 | `Ctrl+F` | `⌘F` |
| ワークスペース検索 | `Ctrl+Shift+F` | `⌘⇧F` |
| クイックオープン | `Ctrl+P` | `⌘P` |
| ライブプレビュー / ソース | `Ctrl+/` | `⌘/` |
| サイドバー切り替え | `Ctrl+Shift+L` | `⌘⇧L` |
| 設定 | `Ctrl+,` | `⌘,` |
| 集中モード | `F8` | `F8` |
| タイプライターモード | `F9` | `F9` |

完全な一覧は InkNote の **ヘルプ → キーボードショートカット** から確認できます。

## プライバシーとローカルデータ

InkNote はアカウントを要求せず、文書をアップロードしません。ファイルは指定した場所に保存されます。ワークスペース、最近使ったファイル、設定は、各 OS のアプリケーションデータ領域に `settings.json` として保存されます。

## ソースからビルド

### 必要な環境

- Node.js LTS と pnpm
- Rust stable
- [Tauri 2 のプラットフォーム要件](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/likehao19/InkNote.git
cd InkNote/InkNote
pnpm install
pnpm tauri dev
```

プロジェクトの検証とデスクトップバンドルの作成：

```bash
pnpm test
pnpm build
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## 技術

InkNote は Tauri 2 と Rust、React 19 と TypeScript、CodeMirror 6、unified/remark/rehype、KaTeX、Mermaid、highlight.js で構築されています。

## コントリビューション

再現可能な不具合報告や明確な機能提案は [GitHub Issues](https://github.com/likehao19/InkNote/issues) へお寄せください。コミュニティ：[LinuxDo](https://linux.do)

## コントリビューター

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

## ライセンス

InkNote は [MIT License](LICENSE) のもとで公開されています。
