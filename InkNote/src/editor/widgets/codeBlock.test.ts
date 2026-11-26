import { describe, expect, it } from "vitest";
import { CodeBlockWidget } from "./codeBlock";

describe("CodeBlockWidget syntax highlighting", () => {
  it("highlights bash CLI flags, numbers, commands, and continuation operators", () => {
    const code = [
      "docker run -d --name upq-redis-sc --network host \\",
      "  --memory 128m --cpus 0.5 -v /data:/data:Z",
    ].join("\n");

    const widget = new CodeBlockWidget(0, code.length, code, "bash");
    const dom = widget.toDOM();
    const html = dom.querySelector("code")?.innerHTML ?? "";

    expect(html).toContain('class="hljs-built_in">docker</span>');
    expect(html).toContain('class="hljs-attr">-d</span>');
    expect(html).toContain('class="hljs-attr">--name</span>');
    expect(html).toContain('class="hljs-attr">--memory</span>');
    expect(html).toContain('class="hljs-number">128m</span>');
    expect(html).toContain('class="hljs-number">0.5</span>');
    expect(html).toContain('class="hljs-attr">-v</span>');
  });

  it("supports extended DevOps and backend languages such as dockerfile, nginx, powershell, and kotlin", () => {
    for (const [lang, sample] of [
      ["dockerfile", "FROM node:22-alpine\nRUN npm ci"],
      ["nginx", "server {\n  listen 80;\n}"],
      ["powershell", "$name = 'InkNote'\nWrite-Host $name"],
      ["kotlin", "fun main() { println(\"ok\") }"],
      ["properties", "spring.datasource.url=jdbc:mysql://localhost/app"],
    ] as const) {
      const widget = new CodeBlockWidget(0, sample.length, sample, lang);
      const dom = widget.toDOM();
      const html = dom.querySelector("code")?.innerHTML ?? "";
      expect(html).toContain("hljs-");
    }
  });
});
