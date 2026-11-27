import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyCustomCssToHost, setCustomCssPath } from "./customTheme";
import { resetSettingsStoreForTests } from "./settingsStore";

const SAMPLES: Record<string, string> = {
  "pixyll.css": `
    html[data-md-theme] .editor-host.editor-host { --md-accent: #463f5c; background: #ffffff; }
    html[data-md-theme] .editor-host.editor-host.editor-host--preview .cm-content { max-width: min(1320px, 100%); }
    html[data-md-theme] .editor-host.editor-host .md-table-widget thead th { border-bottom: 2px solid #333333; background: transparent; }
    html[data-md-theme] .editor-host.editor-host .md-table-widget tbody tr:nth-child(2n) td { background: transparent; }
  `,
  "newsprint.css": `
    html[data-md-theme] .editor-host.editor-host { --md-accent: #065588; background: #f3f2ee; }
    html[data-md-theme] .editor-host.editor-host .md-table-widget thead th { background: #dadada; border: 0; }
    html[data-md-theme] .editor-host.editor-host .md-table-widget tbody tr:nth-child(2n) td { background: #e8e7e7; }
  `,
};

vi.mock("./tauri", () => ({
  readFile: vi.fn((path: string) => {
    const css = SAMPLES[path];
    if (!css) return Promise.reject(new Error(`Missing theme: ${path}`));
    return Promise.resolve(css);
  }),
}));

describe("Standalone custom CSS themes", () => {
  beforeEach(() => {
    resetSettingsStoreForTests();
    document.body.replaceChildren();
  });

  it("parses and preserves high-specificity editor-host theme selectors", async () => {
    for (const key of Object.keys(SAMPLES)) {
      const host = document.createElement("div");
      host.className = "editor-host";
      document.body.appendChild(host);
      setCustomCssPath(key);
      applyCustomCssToHost(host);

      await vi.waitFor(() => {
        const style = host.querySelector("#mdnote-custom-css");
        expect(style?.textContent?.length).toBeGreaterThan(100);
      });

      const cssText = host.querySelector("#mdnote-custom-css")?.textContent ?? "";
      expect(cssText).not.toContain("could not parse");
      expect(cssText).toContain("html[data-md-theme] .editor-host.editor-host");
      expect(cssText).toContain(".md-table-widget");
    }
  });
});
