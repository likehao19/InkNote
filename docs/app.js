const REPOSITORY = "likehao19/InkNote";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;

const messages = {
  zh: {
    title: "墨笺 InkNote — 专注写作的 Markdown 编辑器",
    description: "墨笺 InkNote，一款本地优先、所见即所得的跨平台 Markdown 编辑器。",
    skip: "跳到主要内容", brandZh: "墨笺", navFeatures: "功能", navScreens: "界面", navDownload: "下载",
    eyebrow: "本地优先 · 跨平台", heroTitle: "写 Markdown，<br />只看内容本身。", heroLead: "墨笺是一款所见即所得的桌面 Markdown 编辑器。没有割裂的双栏预览，点击即可编辑，移开焦点即呈现最终排版。",
    downloadNow: "立即下载", viewGithub: "查看 GitHub", latest: "最新版本", freeDownload: "免费下载",
    files: "文件", outline: "大纲", recent: "最近", filterFiles: "筛选文件…", mockIntro: "专注于内容的本地 Markdown 编辑器。", mockQuoteTitle: "所见即所得", mockQuote: "编辑时显示语法，完成后恢复清晰排版。", mockFeatures: "核心能力", mockItem1: "表格与任务列表", mockItem2: "数学公式与图表", mockTableFeature: "功能", mockTableSupport: "支持", preview: "预览",
    galleryTitle: "编辑细节，一目了然", galleryLead: "常用组件保持接近最终排版，同时提供恰到好处的编辑控件。", galleryTableTitle: "表格直接编辑", galleryTableText: "选择单元格后完成对齐、增删行列，未选中时可操作整张表格。", galleryCodeTitle: "清晰的代码块", galleryCodeText: "行号、语法高亮、语言选择与独立横向滚动互不干扰。", gallerySearchTitle: "工作区全文检索", gallerySearchText: "按文件名或正文查找，点击结果即可展开文件树并定位到对应行。",
    featuresTitle: "完整能力，安静呈现", featuresLead: "围绕 Markdown 写作本身设计，每项功能都留在需要它的位置。",
    feature1Title: "无缝实时预览", feature1Text: "标题、列表、引用、代码与表格在同一编辑面中完成输入和排版。",
    feature2Title: "组件化编辑", feature2Text: "代码块、表格、任务列表、公式与图表均可直接点击编辑。",
    feature3Title: "文档与工作区检索", feature3Text: "支持当前文档查找替换，以及跨工作区按文件名和内容搜索。",
    feature4Title: "专业 Markdown", feature4Text: "支持 GFM、KaTeX 数学公式、Mermaid 图表与 YAML Front Matter。",
    feature5Title: "本地工作区", feature5Text: "多根目录文件树、大纲、最近文档与本地设置，内容始终由你掌控。",
    feature6Title: "导出与更新", feature6Text: "直接导出 HTML/PDF，并可在应用内检查、下载和安装新版本。",
    workflowTitle: "从打开到交付，保持一条写作流", workflowText: "使用文件关联快速预览，切换到编辑模式继续修改；需要交付时直接导出 HTML 或 PDF。源文件始终是标准 Markdown。",
    flow1Title: "打开", flow1Text: "文件、文件夹或最近文档", flow2Title: "写作", flow2Text: "实时预览或源码模式", flow3Title: "交付", flow3Text: "保存 Markdown，导出 HTML/PDF",
    downloadTitle: "选择你的平台", downloadLead: "按钮将直接下载 GitHub 最新 Release 中的安装包。", checking: "正在检查最新版本…", releaseReady: "已找到 {version}", releaseFallback: "暂时使用稳定版下载地址",
    windowsMeta: "Windows 10/11 · x64 · EXE", macMeta: "Intel 与 Apple 芯片 · DMG", linuxMeta: "x86_64 · AppImage",
    downloadWindows: "下载 Windows 版", downloadMac: "下载 macOS 版", downloadLinux: "下载 Linux 版", otherPackages: "需要 MSI、DEB 或历史版本？", allReleases: "查看全部 Releases ↗",
    footerText: "为专注的 Markdown 写作而设计。", issues: "问题反馈"
  },
  en: {
    title: "InkNote — A focused Markdown editor",
    description: "InkNote is a local-first, WYSIWYG Markdown editor for Windows, macOS, and Linux.",
    skip: "Skip to main content", brandZh: "", navFeatures: "Features", navScreens: "Interface", navDownload: "Download",
    eyebrow: "Local first · Cross-platform", heroTitle: "Write Markdown.<br />See only the content.", heroLead: "InkNote is a WYSIWYG desktop Markdown editor. There is no disconnected split preview: click to edit, then return to the finished typeset view when focus moves away.",
    downloadNow: "Download now", viewGithub: "View on GitHub", latest: "Latest", freeDownload: "Free download",
    files: "Files", outline: "Outline", recent: "Recent", filterFiles: "Filter files…", mockIntro: "A local Markdown editor that keeps the content in focus.", mockQuoteTitle: "What you see is what you get", mockQuote: "Syntax appears while editing and steps back when you are done.", mockFeatures: "Core capabilities", mockItem1: "Tables and task lists", mockItem2: "Math and diagrams", mockTableFeature: "Feature", mockTableSupport: "Support", preview: "Preview",
    galleryTitle: "Editing details at a glance", galleryLead: "Common components stay close to their final layout while exposing only the controls you need.", galleryTableTitle: "Edit tables directly", galleryTableText: "Select cells to align or modify them, or operate on the whole table when nothing is selected.", galleryCodeTitle: "Readable code blocks", galleryCodeText: "Line numbers, highlighting, language selection, and horizontal scrolling stay out of one another's way.", gallerySearchTitle: "Workspace-wide search", gallerySearchText: "Search filenames or content, then open the file tree and jump directly to the matching line.",
    featuresTitle: "Complete tools, quietly presented", featuresLead: "Everything is designed around Markdown writing and appears only where it is useful.",
    feature1Title: "Seamless live preview", feature1Text: "Write and format headings, lists, quotes, code, and tables in one editing surface.",
    feature2Title: "Direct component editing", feature2Text: "Click into code blocks, tables, task lists, math, and diagrams to edit them in place.",
    feature3Title: "Document and workspace search", feature3Text: "Find and replace in the current document, or search filenames and content across the workspace.",
    feature4Title: "Full Markdown support", feature4Text: "Use GFM, KaTeX math, Mermaid diagrams, and YAML Front Matter.",
    feature5Title: "Local workspaces", feature5Text: "Manage multiple folder roots, outlines, recent documents, and local settings while keeping control of your files.",
    feature6Title: "Export and updates", feature6Text: "Export directly to HTML or PDF, and check, download, and install updates inside the app.",
    workflowTitle: "One writing flow, from open to delivery", workflowText: "Preview files opened through system associations, switch to edit mode when needed, and export to HTML or PDF. The source always remains standard Markdown.",
    flow1Title: "Open", flow1Text: "A file, folder, or recent document", flow2Title: "Write", flow2Text: "Live preview or source mode", flow3Title: "Deliver", flow3Text: "Save Markdown or export HTML/PDF",
    downloadTitle: "Choose your platform", downloadLead: "Each button downloads the matching installer from the latest GitHub Release.", checking: "Checking the latest release…", releaseReady: "Latest release: {version}", releaseFallback: "Using stable download links",
    windowsMeta: "Windows 10/11 · x64 · EXE", macMeta: "Intel and Apple silicon · DMG", linuxMeta: "x86_64 · AppImage",
    downloadWindows: "Download for Windows", downloadMac: "Download for macOS", downloadLinux: "Download for Linux", otherPackages: "Need MSI, DEB, or an older version?", allReleases: "View all Releases ↗",
    footerText: "Designed for focused Markdown writing.", issues: "Report an issue"
  }
};

let currentLanguage = localStorage.getItem("inknote-site-language") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
let releaseStateKey = "checking";
let releaseStateVersion = "";

function translate(language) {
  const dictionary = messages[language] || messages.en;
  currentLanguage = language;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = dictionary.title;
  document.querySelector('meta[name="description"]').setAttribute("content", dictionary.description);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = dictionary[element.dataset.i18n];
    if (value !== undefined) element.innerHTML = value;
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === language));
  });
  setReleaseState(releaseStateKey, releaseStateVersion);
  localStorage.setItem("inknote-site-language", language);
}

function chooseAsset(assets, platform) {
  const candidates = assets.filter((asset) => !asset.name.endsWith(".sig"));
  const tests = {
    windows: [/x64-setup\.exe$/i, /setup\.exe$/i, /\.msi$/i],
    macos: [/universal\.dmg$/i, /aarch64\.dmg$/i, /x64\.dmg$/i, /\.dmg$/i],
    linux: [/amd64\.AppImage$/i, /x86_64\.AppImage$/i, /\.AppImage$/i, /\.deb$/i]
  };
  for (const pattern of tests[platform]) {
    const match = candidates.find((asset) => pattern.test(asset.name));
    if (match) return match;
  }
  return null;
}

function setReleaseState(key, version = "") {
  releaseStateKey = key;
  releaseStateVersion = version;
  const state = document.querySelector("[data-release-state]");
  if (state) state.textContent = messages[currentLanguage][key].replace("{version}", version);
}

async function loadLatestRelease() {
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const release = await response.json();
    const version = release.tag_name || "latest";
    document.querySelectorAll("[data-release-version]").forEach((node) => { node.textContent = version; });
    document.querySelectorAll("[data-platform]").forEach((link) => {
      const asset = chooseAsset(release.assets || [], link.dataset.platform);
      if (asset) {
        link.href = asset.browser_download_url;
        link.dataset.assetName = asset.name;
      }
    });
    setReleaseState("releaseReady", version);
  } catch (error) {
    console.warn("Unable to refresh release links; keeping stable fallbacks.", error);
    setReleaseState("releaseFallback");
  }
}

document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => translate(button.dataset.lang)));
document.querySelector("[data-current-year]").textContent = new Date().getFullYear();
translate(currentLanguage);
loadLatestRelease();
