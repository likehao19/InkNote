import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";
import { readFile } from "./tauri";

const KEY = "mdnote.customCss";
const STYLE_ID = "mdnote-custom-css";

export function getCustomCssPath(): string | null {
  return getStoredValue(KEY);
}

export function setCustomCssPath(path: string | null) {
  if (path) setStoredValue(KEY, path);
  else removeStoredValue(KEY);
  window.dispatchEvent(new Event("mdnote-custom-css-changed"));
}

function scopedSelector(selector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(".editor-host")) return trimmed;
  if (/^(?::root|html|body)$/i.test(trimmed)) return ".editor-host";
  if (/^body(?=[\s.#:[>+~])/i.test(trimmed)) {
    return trimmed.replace(/^body/i, ".editor-host");
  }
  return `.editor-host ${trimmed}`;
}

function serializeScopedRules(rules: CSSRuleList): string {
  return Array.from(rules).map((rule) => {
    if (rule instanceof CSSStyleRule) {
      const selectors = rule.selectorText.split(",").map(scopedSelector).join(", ");
      return `${selectors} { ${rule.style.cssText} }`;
    }
    if (typeof CSSImportRule !== "undefined" && rule instanceof CSSImportRule) return "";
    if (
      "cssRules" in rule &&
      rule.cssRules instanceof CSSRuleList &&
      !/^@(?:keyframes|-webkit-keyframes|font-face|property)/i.test(rule.cssText)
    ) {
      const brace = rule.cssText.indexOf("{");
      const header = brace >= 0 ? rule.cssText.slice(0, brace).trim() : "";
      return header ? `${header} { ${serializeScopedRules(rule.cssRules)} }` : "";
    }
    return rule.cssText;
  }).join("\n");
}

function scopeCss(css: string): string {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return serializeScopedRules(sheet.cssRules);
  } catch {
    return `/* InkNote could not parse this custom stylesheet safely. */`;
  }
}

/** 将自定义 CSS 限定到编辑器容器，避免改坏标题栏、侧栏和设置界面。 */
export function applyCustomCssToHost(host: HTMLElement | null) {
  const existing = host?.querySelector(`#${STYLE_ID}`);
  if (existing) existing.remove();

  const path = getCustomCssPath();
  if (!host || !path) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.dataset.path = path;
  host.appendChild(style);
  void readFile(path).then((css) => {
    if (!style.isConnected || style.dataset.path !== path) return;
    style.textContent = scopeCss(css);
  }).catch(() => {
    if (style.isConnected) style.remove();
  });
}

export function removeCustomCssFromHost(host: HTMLElement | null) {
  host?.querySelector(`#${STYLE_ID}`)?.remove();
}
