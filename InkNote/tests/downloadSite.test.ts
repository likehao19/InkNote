import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(import.meta.dirname, "../../docs/index.html"), "utf8");
const script = readFileSync(resolve(import.meta.dirname, "../../docs/app.js"), "utf8");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("inknote-site-language", "zh");
  // Exercise the script explicitly below without loading CSS or remote resources.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<link\b[^>]*>/gi, "");
  const page = new DOMParser().parseFromString(markup, "text/html");
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tag_name: "v0.2.15", assets: [] }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe("download button copy", () => {
  it.each([
    ["Windows", "x86", "windows"],
    ["macOS", "arm64", "macos-arm64"],
    ["macOS", "x86", "macos-x64"],
    ["Linux", "x86", "linux-x64-appimage"],
    ["Linux", "arm64", "linux-arm64-appimage"],
  ])("uses concise labels without changing %s %s download targets", async (platform, architecture, key) => {
    vi.stubGlobal("navigator", { userAgentData: { platform, architecture, getHighEntropyValues: async () => ({ architecture, bitness: "64" }) } });
    new Function(script)();
    await vi.waitFor(() => expect(document.querySelector("[data-detected-label]")?.textContent).toBe("下载"));
    const link = document.querySelector<HTMLAnchorElement>("[data-detected-link]")!;
    expect(link.href).toBe(document.querySelector<HTMLAnchorElement>(`[data-platform="${key}"]`)!.href);
    expect(link.getAttribute("aria-label")).toContain("下载");
    expect(document.querySelector("[data-recommended-label]")?.textContent).toBe("下载");
    expect(document.querySelector('[data-platform="windows"] [data-i18n]')?.textContent).toBe("下载");
    document.querySelector<HTMLButtonElement>('[data-lang="en"]')!.click();
    expect(document.querySelector("[data-detected-label]")?.textContent).toBe("Download");
    expect(link.getAttribute("aria-label")).toContain("Download");
    expect(document.querySelector('[data-platform="windows"]')?.getAttribute("aria-label")).toBe("Download Windows x64");
  });

  it("keeps the package chooser when the device cannot be identified", async () => {
    vi.stubGlobal("navigator", { platform: "unknown" });
    new Function(script)();
    await vi.waitFor(() => expect(document.querySelector("[data-detected-label]")?.textContent).toBe("查看全部下载"));
    expect(document.querySelector("[data-detected-link]")?.getAttribute("href")).toBe("#platform-downloads");
  });
});
