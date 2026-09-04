const REPOSITORY = "likehao19/InkNote";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;

const messages = {
  zh: {
    title: "墨笺 InkNote — 专注写作的 Markdown 编辑器",
    description: "墨笺 InkNote，一款面向 Windows、macOS 与 Linux 的本地优先、所见即所得 Markdown 编辑器。",
    skip: "跳到主要内容", brandZh: "墨笺", navFeatures: "功能", navScreens: "界面", navDownload: "下载",
    eyebrow: "本地优先 · Windows / macOS / Linux", heroTitle: "写 Markdown，<br />只看内容本身。", heroLead: "墨笺是一款所见即所得的桌面 Markdown 编辑器。没有割裂的双栏预览，点击即可编辑，移开焦点即呈现最终排版。",
    downloadNow: "立即下载", viewGithub: "查看 GitHub", latest: "最新版本", freeDownload: "免费下载",
    files: "文件", outline: "大纲", recent: "最近", filterFiles: "筛选文件…", mockIntro: "专注于内容的本地 Markdown 编辑器。", mockQuoteTitle: "所见即所得", mockQuote: "编辑时显示语法，完成后恢复清晰排版。", mockFeatures: "核心能力", mockItem1: "表格与任务列表", mockItem2: "数学公式与图表", mockTableFeature: "功能", mockTableSupport: "支持", preview: "预览",
    galleryTitle: "编辑细节，一目了然", galleryLead: "常用组件保持接近最终排版，同时提供恰到好处的编辑控件。", galleryTableTitle: "表格直接编辑", galleryTableText: "选择单元格后完成对齐、增删行列，未选中时可操作整张表格。", galleryCodeTitle: "清晰的代码块", galleryCodeText: "行号、语法高亮、语言选择与独立横向滚动互不干扰。", gallerySearchTitle: "工作区全文检索", gallerySearchText: "按文件名或正文查找，点击结果即可展开文件树并定位到对应行。",
    featuresTitle: "完整能力，安静呈现", featuresLead: "围绕 Markdown 写作本身设计，每项功能都留在需要它的位置。",
    feature1Title: "无缝实时预览", feature1Text: "标题、列表、引用、代码与表格在同一编辑面中完成输入和排版。",
    feature2Title: "组件化编辑", feature2Text: "代码块、表格、任务列表、公式与图表均可直接点击编辑。",
    feature3Title: "文档与工作区检索", feature3Text: "支持当前文档查找替换，以及跨工作区按文件名和内容搜索。",
    feature4Title: "专业 Markdown", feature4Text: "支持 GFM、KaTeX 数学公式、Mermaid 图表与 YAML Front Matter。",
    feature5Title: "本地工作区", feature5Text: "多根目录文件树、大纲、最近文档与本地设置，内容始终由你掌控。",
    feature6Title: "导出与更新", feature6Text: "直接导出 HTML（Windows/macOS 也支持 PDF），并可在应用内检查、下载和安装新版本。",
    workflowTitle: "从打开到交付，保持一条写作流", workflowText: "使用文件关联快速预览，切换到编辑模式继续修改；需要交付时直接导出 HTML，Windows/macOS 还可导出 PDF。源文件始终是标准 Markdown。",
    flow1Title: "打开", flow1Text: "文件、文件夹或最近文档", flow2Title: "写作", flow2Text: "实时预览或源码模式", flow3Title: "交付", flow3Text: "保存 Markdown，导出 HTML/PDF",
    downloadTitle: "下载 InkNote", downloadLead: "已覆盖 Windows、macOS 与主流 Linux 发行版。", checking: "正在检查最新版本…", releaseReady: "最新版本 {version}", releaseFallback: "暂时使用稳定版下载地址",
    detectedKicker: "智能推荐", recommended: "推荐", windowsMeta: "Windows 10/11 · x64 · 中文安装程序", macMeta: "支持 Apple 芯片与 Intel Mac · DMG", appleSilicon: "Apple 芯片", linuxMeta: "AppImage、DEB 与 RPM · x64 / ARM64",
    downloadWindows: "下载 Windows 版", otherPackages: "校验签名或下载历史版本：", allReleases: "查看全部 Releases ↗",
    detectedWindowsTitle: "已识别 Windows", detectedWindowsDescription: "推荐 Windows 10/11 x64 中文安装程序。", detectedWindowsLabel: "下载 Windows x64",
    detectedMacArmTitle: "已识别 Apple 芯片 Mac", detectedMacArmDescription: "推荐适用于 M 系列芯片的 ARM64 DMG 安装包。", detectedMacArmLabel: "下载 macOS ARM64",
    detectedMacIntelTitle: "已识别 Intel Mac", detectedMacIntelDescription: "推荐适用于 Intel 处理器的 x86_64 DMG 安装包。", detectedMacIntelLabel: "下载 macOS Intel",
    detectedMacTitle: "已识别 macOS", detectedMacDescription: "请选择与你的 Mac 芯片对应的安装包。", detectedMacLabel: "选择 macOS 版本",
    detectedLinuxX64Title: "已识别 Linux x86_64", detectedLinuxX64Description: "推荐通用 AppImage，也可选择 DEB 或 RPM。", detectedLinuxX64Label: "下载 Linux AppImage",
    detectedLinuxArmTitle: "已识别 Linux ARM64", detectedLinuxArmDescription: "推荐 ARM64 AppImage，也可选择 DEB 或 RPM。", detectedLinuxArmLabel: "下载 Linux ARM64",
    detectedLinuxTitle: "已识别 Linux", detectedLinuxDescription: "请选择处理器架构与发行版对应的安装格式。", detectedLinuxLabel: "选择 Linux 安装包",
    detectedUnknownTitle: "选择适合你的桌面版本", detectedUnknownDescription: "支持 Windows、macOS 和 Linux，可在下方按系统与架构选择。", detectedUnknownLabel: "查看全部下载",
    detectedMetaWindows: "已匹配 Windows x64", detectedMetaMacArm: "已匹配 macOS ARM64", detectedMetaMacIntel: "已匹配 macOS Intel", detectedMetaMac: "macOS · 请选择芯片", detectedMetaLinuxX64: "已匹配 Linux x86_64", detectedMetaLinuxArm: "已匹配 Linux ARM64", detectedMetaLinux: "Linux · 请选择架构", detectedMetaUnknown: "支持 Windows / macOS / Linux",
    footerText: "为专注的 Markdown 写作而设计。", issues: "问题反馈"
  },
  en: {
    title: "InkNote — A focused Markdown editor",
    description: "InkNote is a local-first WYSIWYG Markdown editor for Windows, macOS, and Linux.",
    skip: "Skip to main content", brandZh: "", navFeatures: "Features", navScreens: "Interface", navDownload: "Download",
    eyebrow: "Local first · Windows / macOS / Linux", heroTitle: "Write Markdown.<br />See only the content.", heroLead: "InkNote is a WYSIWYG desktop Markdown editor. There is no disconnected split preview: click to edit, then return to the finished typeset view when focus moves away.",
    downloadNow: "Download now", viewGithub: "View on GitHub", latest: "Latest", freeDownload: "Free download",
    files: "Files", outline: "Outline", recent: "Recent", filterFiles: "Filter files…", mockIntro: "A local Markdown editor that keeps the content in focus.", mockQuoteTitle: "What you see is what you get", mockQuote: "Syntax appears while editing and steps back when you are done.", mockFeatures: "Core capabilities", mockItem1: "Tables and task lists", mockItem2: "Math and diagrams", mockTableFeature: "Feature", mockTableSupport: "Support", preview: "Preview",
    galleryTitle: "Editing details at a glance", galleryLead: "Common components stay close to their final layout while exposing only the controls you need.", galleryTableTitle: "Edit tables directly", galleryTableText: "Select cells to align or modify them, or operate on the whole table when nothing is selected.", galleryCodeTitle: "Readable code blocks", galleryCodeText: "Line numbers, highlighting, language selection, and horizontal scrolling stay out of one another's way.", gallerySearchTitle: "Workspace-wide search", gallerySearchText: "Search filenames or content, then open the file tree and jump directly to the matching line.",
    featuresTitle: "Complete tools, quietly presented", featuresLead: "Everything is designed around Markdown writing and appears only where it is useful.",
    feature1Title: "Seamless live preview", feature1Text: "Write and format headings, lists, quotes, code, and tables in one editing surface.",
    feature2Title: "Direct component editing", feature2Text: "Click into code blocks, tables, task lists, math, and diagrams to edit them in place.",
    feature3Title: "Document and workspace search", feature3Text: "Find and replace in the current document, or search filenames and content across the workspace.",
    feature4Title: "Full Markdown support", feature4Text: "Use GFM, KaTeX math, Mermaid diagrams, and YAML Front Matter.",
    feature5Title: "Local workspaces", feature5Text: "Manage multiple folder roots, outlines, recent documents, and local settings while keeping control of your files.",
    feature6Title: "Export and updates", feature6Text: "Export directly to HTML (or PDF on Windows and macOS), and check, download, and install updates inside the app.",
    workflowTitle: "One writing flow, from open to delivery", workflowText: "Preview files opened through system associations, switch to edit mode when needed, and export to HTML or, on Windows and macOS, PDF. The source always remains standard Markdown.",
    flow1Title: "Open", flow1Text: "A file, folder, or recent document", flow2Title: "Write", flow2Text: "Live preview or source mode", flow3Title: "Deliver", flow3Text: "Save Markdown or export HTML/PDF",
    downloadTitle: "Download InkNote", downloadLead: "Available for Windows, macOS, and major Linux distributions.", checking: "Checking the latest release…", releaseReady: "Latest release {version}", releaseFallback: "Using stable download links",
    detectedKicker: "Recommended for you", recommended: "Recommended", windowsMeta: "Windows 10/11 · x64 · Chinese installer", macMeta: "Apple silicon and Intel Mac · DMG", appleSilicon: "Apple silicon", linuxMeta: "AppImage, DEB, and RPM · x64 / ARM64",
    downloadWindows: "Download for Windows", otherPackages: "Signatures or previous versions:", allReleases: "View all Releases ↗",
    detectedWindowsTitle: "Windows detected", detectedWindowsDescription: "The Windows 10/11 x64 installer is recommended for this device.", detectedWindowsLabel: "Download Windows x64",
    detectedMacArmTitle: "Apple silicon Mac detected", detectedMacArmDescription: "The ARM64 DMG is recommended for M-series Macs.", detectedMacArmLabel: "Download macOS ARM64",
    detectedMacIntelTitle: "Intel Mac detected", detectedMacIntelDescription: "The x86_64 DMG is recommended for Intel-based Macs.", detectedMacIntelLabel: "Download macOS Intel",
    detectedMacTitle: "macOS detected", detectedMacDescription: "Choose the download that matches your Mac's processor.", detectedMacLabel: "Choose a macOS build",
    detectedLinuxX64Title: "Linux x86_64 detected", detectedLinuxX64Description: "Use the universal AppImage, or choose DEB or RPM below.", detectedLinuxX64Label: "Download Linux AppImage",
    detectedLinuxArmTitle: "Linux ARM64 detected", detectedLinuxArmDescription: "Use the ARM64 AppImage, or choose DEB or RPM below.", detectedLinuxArmLabel: "Download Linux ARM64",
    detectedLinuxTitle: "Linux detected", detectedLinuxDescription: "Choose your processor architecture and preferred package format.", detectedLinuxLabel: "Choose a Linux package",
    detectedUnknownTitle: "Choose your desktop build", detectedUnknownDescription: "InkNote supports Windows, macOS, and Linux. Pick your system and architecture below.", detectedUnknownLabel: "View all downloads",
    detectedMetaWindows: "Matched Windows x64", detectedMetaMacArm: "Matched macOS ARM64", detectedMetaMacIntel: "Matched macOS Intel", detectedMetaMac: "macOS · choose your chip", detectedMetaLinuxX64: "Matched Linux x86_64", detectedMetaLinuxArm: "Matched Linux ARM64", detectedMetaLinux: "Linux · choose architecture", detectedMetaUnknown: "Windows / macOS / Linux",
    footerText: "Designed for focused Markdown writing.", issues: "Report an issue"
  }
};

let currentLanguage = localStorage.getItem("inknote-site-language") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
let releaseStateKey = "checking";
let releaseStateVersion = "";
let detectedSystem = { family: "unknown", platform: null, symbol: "OS" };

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
  renderRecommendation();
  localStorage.setItem("inknote-site-language", language);
}

function chooseAsset(assets, platform) {
  const candidates = assets.filter((asset) => !asset.name.endsWith(".sig"));
  const tests = {
    windows: [/^InkNote-Windows-x64-Setup\.exe$/i, /x64[-_]setup\.exe$/i, /setup\.exe$/i],
    "macos-x64": [/^InkNote-macOS-x86_64\.dmg$/i, /x86_64\.dmg$/i, /x64\.dmg$/i],
    "macos-arm64": [/^InkNote-macOS-arm64\.dmg$/i, /aarch64\.dmg$/i, /arm64\.dmg$/i],
    "linux-x64-appimage": [/^InkNote-Linux-x86_64\.AppImage$/i],
    "linux-x64-deb": [/^InkNote-Linux-x86_64\.deb$/i],
    "linux-x64-rpm": [/^InkNote-Linux-x86_64\.rpm$/i],
    "linux-arm64-appimage": [/^InkNote-Linux-arm64\.AppImage$/i],
    "linux-arm64-deb": [/^InkNote-Linux-arm64\.deb$/i],
    "linux-arm64-rpm": [/^InkNote-Linux-arm64\.rpm$/i]
  };
  for (const pattern of tests[platform] || []) {
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

function normalizeArchitecture(value) {
  const architecture = String(value || "").toLowerCase();
  if (/arm64|aarch64|\barm\b/.test(architecture)) return "arm64";
  if (/x86_64|amd64|x64|\bx86\b/.test(architecture)) return "x64";
  return null;
}

async function detectSystem() {
  const userAgentData = navigator.userAgentData;
  const platform = String(userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  const userAgent = String(navigator.userAgent || "").toLowerCase();
  let architecture = normalizeArchitecture(userAgentData?.architecture);

  if (userAgentData?.getHighEntropyValues) {
    try {
      const details = await userAgentData.getHighEntropyValues(["architecture", "bitness"]);
      architecture = normalizeArchitecture(details.architecture) || architecture;
      if (details.architecture === "x86" && details.bitness === "64") architecture = "x64";
    } catch (error) {
      console.debug("Detailed system detection is unavailable.", error);
    }
  }

  if (/windows|win32|win64/.test(platform) || /windows/.test(userAgent)) {
    return { family: "windows", platform: "windows", symbol: "WIN" };
  }

  if (/android|cros/.test(platform) || /android|cros/.test(userAgent)) {
    return { family: "unknown", platform: null, symbol: "OS" };
  }

  const isTouchMac = /mac/.test(platform) && navigator.maxTouchPoints > 1;
  if (!isTouchMac && (/mac/.test(platform) || /macintosh/.test(userAgent))) {
    if (architecture === "arm64" || /arm64|aarch64/.test(userAgent)) {
      return { family: "macos", platform: "macos-arm64", symbol: "MAC" };
    }
    if (userAgentData && architecture === "x64") {
      return { family: "macos", platform: "macos-x64", symbol: "MAC" };
    }
    return { family: "macos", platform: null, symbol: "MAC" };
  }

  if (/linux/.test(platform) || /linux/.test(userAgent)) {
    architecture = architecture || normalizeArchitecture(userAgent);
    if (architecture === "arm64") {
      return { family: "linux", platform: "linux-arm64-appimage", symbol: "LNX" };
    }
    if (architecture === "x64") {
      return { family: "linux", platform: "linux-x64-appimage", symbol: "LNX" };
    }
    return { family: "linux", platform: null, symbol: "LNX" };
  }

  return { family: "unknown", platform: null, symbol: "OS" };
}

function recommendationKeys(system) {
  if (system.platform === "windows") return ["detectedWindowsTitle", "detectedWindowsDescription", "detectedWindowsLabel", "detectedMetaWindows"];
  if (system.platform === "macos-arm64") return ["detectedMacArmTitle", "detectedMacArmDescription", "detectedMacArmLabel", "detectedMetaMacArm"];
  if (system.platform === "macos-x64") return ["detectedMacIntelTitle", "detectedMacIntelDescription", "detectedMacIntelLabel", "detectedMetaMacIntel"];
  if (system.family === "macos") return ["detectedMacTitle", "detectedMacDescription", "detectedMacLabel", "detectedMetaMac"];
  if (system.platform === "linux-x64-appimage") return ["detectedLinuxX64Title", "detectedLinuxX64Description", "detectedLinuxX64Label", "detectedMetaLinuxX64"];
  if (system.platform === "linux-arm64-appimage") return ["detectedLinuxArmTitle", "detectedLinuxArmDescription", "detectedLinuxArmLabel", "detectedMetaLinuxArm"];
  if (system.family === "linux") return ["detectedLinuxTitle", "detectedLinuxDescription", "detectedLinuxLabel", "detectedMetaLinux"];
  return ["detectedUnknownTitle", "detectedUnknownDescription", "detectedUnknownLabel", "detectedMetaUnknown"];
}

function renderRecommendation() {
  const dictionary = messages[currentLanguage] || messages.en;
  const [titleKey, descriptionKey, labelKey, metaKey] = recommendationKeys(detectedSystem);
  const sourceLink = detectedSystem.platform
    ? document.querySelector(`[data-platform="${detectedSystem.platform}"]`)
    : null;
  const destination = sourceLink?.href || "#platform-downloads";

  const symbol = document.querySelector("[data-detected-symbol]");
  const title = document.querySelector("[data-detected-title]");
  const description = document.querySelector("[data-detected-description]");
  const detectedLabel = document.querySelector("[data-detected-label]");
  const detectedLink = document.querySelector("[data-detected-link]");
  const heroLabel = document.querySelector("[data-recommended-label]");
  const heroMeta = document.querySelector("[data-recommended-meta]");
  const heroLink = document.querySelector(".recommended-download");

  if (symbol) symbol.textContent = detectedSystem.symbol;
  if (title) title.textContent = dictionary[titleKey];
  if (description) description.textContent = dictionary[descriptionKey];
  if (detectedLabel) detectedLabel.textContent = dictionary[labelKey];
  if (heroLabel) heroLabel.textContent = dictionary[labelKey];
  if (heroMeta) heroMeta.textContent = dictionary[metaKey];
  if (detectedLink) detectedLink.href = destination;
  if (heroLink) heroLink.href = destination;

  document.querySelector("[data-detected-download]")?.setAttribute("data-system", detectedSystem.family);
  document.querySelectorAll("[data-download-card]").forEach((card) => {
    card.classList.toggle("is-recommended", card.dataset.downloadCard === detectedSystem.family);
  });
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
    renderRecommendation();
  } catch (error) {
    console.warn("Unable to refresh release links; keeping stable fallbacks.", error);
    setReleaseState("releaseFallback");
  }
}

document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => translate(button.dataset.lang)));
document.querySelector("[data-current-year]").textContent = new Date().getFullYear();
translate(currentLanguage);
void detectSystem().then((system) => {
  detectedSystem = system;
  renderRecommendation();
});
void loadLatestRelease();
