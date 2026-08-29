<h1 align="center">InkNote</h1>

<p align="center"><strong>로컬 우선, 일반 문서를 쓰듯 사용하는 Markdown 편집기.</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  한국어
</p>

<p align="center">
  <a href="https://github.com/likehao19/InkNote/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/InkNote?display_name=tag&sort=semver" alt="최신 릴리스" /></a>
  <a href="https://github.com/likehao19/InkNote/actions/workflows/ci.yml"><img src="https://github.com/likehao19/InkNote/actions/workflows/ci.yml/badge.svg" alt="빌드 상태" /></a>
  <a href="https://github.com/likehao19/InkNote/releases"><img src="https://img.shields.io/github/downloads/likehao19/InkNote/total" alt="다운로드 수" /></a>
  <a href="https://github.com/likehao19/InkNote/stargazers"><img src="https://img.shields.io/github/stars/likehao19/InkNote?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://likehao19.github.io/InkNote/">웹사이트</a> ·
  <a href="https://github.com/likehao19/InkNote/releases/latest">다운로드</a> ·
  <a href="https://github.com/likehao19/InkNote/issues">이슈</a>
</p>

<p align="center">
  <img src="docs/assets/inknote-live-preview.png" alt="InkNote 실시간 미리보기와 문서 개요" width="1000" />
</p>

## Markdown 파일은 그대로, 문법의 불편함은 줄이기

InkNote는 모든 문서를 표준 로컬 Markdown 파일로 보관하면서 일반 문서 편집기처럼 다듬어진 작성 환경을 제공합니다. 입력하는 동안 서식을 바로 확인하고, 복잡한 블록을 제자리에서 편집하며, 필요할 때 언제든 전체 소스로 전환할 수 있습니다.

- **로컬 우선**: 계정, 필수 클라우드, 문서 업로드가 필요하지 않습니다.
- **높은 호환성**: 일반 `.md` 파일이므로 다른 Markdown 도구에서도 열 수 있습니다.
- **안전한 열기**: 새 문서와 기존 문서 모두에 명확한 **미리보기 / 편집** 접근 전환을 표시해 의도하지 않은 수정을 방지합니다.
- **실제 문서 작업용**: 개요, 작업 공간, 검색, 내보내기, 수식, 다이어그램, 표, 코드를 하나의 흐름에서 다룹니다.

## 두 가지 편집 방식

<table>
  <tr>
    <td width="50%"><img src="docs/assets/inknote-source-mode.png" alt="InkNote Markdown 소스 모드" /></td>
    <td width="50%"><img src="docs/assets/inknote-settings.png" alt="InkNote 모양 설정" /></td>
  </tr>
  <tr>
    <td align="center"><strong>실시간 미리보기 또는 전체 소스</strong><br />렌더링된 문서를 직접 편집하거나 전체 Markdown 소스를 확인하고 수정할 수 있습니다.</td>
    <td align="center"><strong>내 방식에 맞는 편집기</strong><br />라이트, 다크, 시스템 연동, Markdown 테마, 타이포그래피와 사용자 CSS를 선택할 수 있습니다.</td>
  </tr>
</table>

## 주요 기능

### 작성과 서식

- 필요할 때만 Markdown 문법을 보여 주는 실시간 미리보기 편집.
- 제목, 목록, 인용문, 링크, 이미지, 작업 목록, 각주, GFM 표.
- 굵게, 기울임, 취소선, 강조, 인라인 코드, 밑줄, 위 첨자와 아래 첨자.
- 집중 모드와 타자기 모드.

### 기술 문서

- 구문 강조, 줄 번호, 복사 버튼을 제공하는 코드 블록.
- KaTeX 인라인 및 블록 수식.
- Mermaid 흐름도, 시퀀스 다이어그램 등.
- 표, 코드, 수식, 다이어그램, 이미지, YAML front matter 제자리 편집.

### 정리와 검색

- 여러 작업 공간 폴더, 파일 트리 상태 유지, 파일 작업.
- 문서 개요, 최근 파일, 빠른 열기.
- 현재 문서에서 찾기와 바꾸기.
- 파일 이름과 내용을 대상으로 한 작업 공간 전체 검색 및 결과 이동.

### 내보내기와 사용자 설정

- 전체 문서를 독립형 HTML 또는 PDF로 내보내기.
- 라이트, 다크, 시스템 연동 화면 모드.
- GitHub, Vue, Minimal Markdown 테마와 사용자 CSS.
- Markdown 파일 연결, 드래그 앤 드롭 열기, 앱 내 업데이트 확인.
- 앱 인터페이스는 영어와 중국어 간체를 지원합니다.

## 다운로드

| 플랫폼 | 패키지 | 아키텍처 |
| --- | --- | --- |
| Windows | [설치 프로그램](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Windows-x64-Setup.exe) | x64 |
| macOS | [Apple Silicon DMG](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-arm64.dmg) | ARM64 |
| macOS | [Intel DMG](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-macOS-x86_64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.AppImage) · [DEB](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.deb) · [RPM](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-x86_64.rpm) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.AppImage) · [DEB](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.deb) · [RPM](https://github.com/likehao19/InkNote/releases/latest/download/InkNote-Linux-arm64.rpm) | ARM64 / aarch64 |

릴리스 노트와 이전 빌드는 [GitHub Releases](https://github.com/likehao19/InkNote/releases)에서 확인할 수 있습니다.

## 설치

### Windows

`InkNote-Windows-x64-Setup.exe`를 다운로드하고 설치 프로그램 안내를 따르세요. 현재 Windows 릴리스는 x64 시스템을 지원합니다.

### macOS

Mac에 맞는 DMG를 열고 **InkNote**를 **Applications** 폴더로 드래그하세요.

이 프로젝트는 현재 유료 Apple Developer 인증서를 사용하지 않으므로 앱은 ad-hoc 서명되어 있습니다. Gatekeeper가 첫 실행을 차단하면 **시스템 설정 → 개인정보 보호 및 보안**에서 **확인 없이 열기**를 선택하세요. macOS에서 앱이 손상되었다고 표시하면 다음 명령을 실행하세요.

```bash
xattr -dr com.apple.quarantine /Applications/InkNote.app
```

이 명령은 다운로드한 앱의 격리 속성만 제거하며 문서는 변경하지 않습니다.

### Linux

`uname -m`으로 아키텍처를 확인하세요. 64비트 Intel/AMD 시스템은 `x86_64`, `aarch64`로 표시되는 시스템은 `arm64`를 선택합니다.

- Ubuntu, Debian, Linux Mint, Pop!_OS 등 Debian 계열 배포판에서는 **DEB**를 사용합니다.
- Fedora, RHEL, Rocky Linux, AlmaLinux, openSUSE 등 RPM 계열 배포판에서는 **RPM**을 사용합니다.
- 그 밖의 주요 glibc 기반 배포판에서는 **AppImage**를 사용할 수 있습니다. Alpine Linux와 같은 musl 기반 시스템은 현재 지원하지 않습니다.

```bash
# AppImage (ARM64 시스템에서는 x86_64를 arm64로 바꾸세요)
chmod +x InkNote-Linux-x86_64.AppImage
./InkNote-Linux-x86_64.AppImage

# Debian 계열
sudo apt install ./InkNote-Linux-x86_64.deb

# Fedora / RHEL 계열
sudo dnf install ./InkNote-Linux-x86_64.rpm

# openSUSE
sudo zypper install ./InkNote-Linux-x86_64.rpm
```

Linux 버전은 HTML 내보내기를 지원하지만 PDF 내보내기는 현재 사용할 수 없습니다.

## 키보드 단축키

| 작업 | Windows | macOS |
| --- | --- | --- |
| 새 문서 | `Ctrl+N` | `⌘N` |
| 파일 열기 | `Ctrl+O` | `⌘O` |
| 저장 | `Ctrl+S` | `⌘S` |
| 찾기 / 바꾸기 | `Ctrl+F` | `⌘F` |
| 작업 공간 검색 | `Ctrl+Shift+F` | `⌘⇧F` |
| 빠른 열기 | `Ctrl+P` | `⌘P` |
| 실시간 미리보기 / 소스 | `Ctrl+/` | `⌘/` |
| 사이드바 전환 | `Ctrl+Shift+L` | `⌘⇧L` |
| 설정 | `Ctrl+,` | `⌘,` |
| 집중 모드 | `F8` | `F8` |
| 타자기 모드 | `F9` | `F9` |

전체 목록은 InkNote의 **도움말 → 키보드 단축키**에서 확인할 수 있습니다.

## 개인정보 보호와 로컬 데이터

InkNote는 계정을 요구하지 않으며 문서를 업로드하지 않습니다. 파일은 사용자가 지정한 위치에 저장됩니다. 작업 공간, 최근 파일, 환경 설정은 각 운영체제의 애플리케이션 데이터 폴더에 `settings.json`으로 저장됩니다.

## 소스에서 빌드

### 요구 사항

- Node.js LTS와 pnpm
- Rust stable
- [Tauri 2 플랫폼 요구 사항](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/likehao19/InkNote.git
cd InkNote/InkNote
pnpm install
pnpm tauri dev
```

프로젝트를 검사하고 데스크톱 번들을 만듭니다.

```bash
pnpm test
pnpm build
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## 기술

InkNote는 Tauri 2와 Rust, React 19와 TypeScript, CodeMirror 6, unified/remark/rehype, KaTeX, Mermaid, highlight.js로 만들어졌습니다.

## 기여

재현 가능한 버그와 범위가 명확한 기능 제안은 [GitHub Issues](https://github.com/likehao19/InkNote/issues)에 남겨 주세요. 커뮤니티: [LinuxDo](https://linux.do)

## 기여자

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

## 라이선스

InkNote는 [MIT License](LICENSE)로 공개됩니다.
