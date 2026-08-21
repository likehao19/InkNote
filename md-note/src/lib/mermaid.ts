type MermaidTheme = "dark" | "default" | "neutral";
type MermaidApi = typeof import("mermaid")["default"];

let mermaidPromise: Promise<MermaidApi> | null = null;
let activeTheme: MermaidTheme | null = null;

/** Mermaid 体积较大，仅在文档实际包含图表时加载。 */
export async function configuredMermaid(theme: MermaidTheme): Promise<MermaidApi> {
  mermaidPromise ??= import("mermaid").then((module) => module.default);
  const mermaid = await mermaidPromise;
  if (activeTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "strict",
    });
    activeTheme = theme;
  }
  return mermaid;
}
