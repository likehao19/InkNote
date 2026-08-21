import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { createEditor, type EditorHandle } from "./editor";
import sampleMarkdown from "../sample.md?raw";

const handles: EditorHandle[] = [];

function mount(markdown: string) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const onChange = vi.fn();
  const handle = createEditor(parent, markdown, {
    mode: "preview",
    filePath: null,
    typewriter: false,
    lineNumbers: false,
    wordWrap: true,
    tabSize: 2,
    spellCheck: false,
    onChange,
    onModeChange: vi.fn(),
  });
  handles.push(handle);
  return { parent, handle, onChange };
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});

describe("Markdown 所见即所得预览", () => {
  it("keeps the complete bundled sample in live preview mode", () => {
    const { parent, handle } = mount(sampleMarkdown);
    expect(parent.querySelector(".md-frontmatter-widget")).not.toBeNull();
    let tables = 0;
    let fencedCode = 0;
    const completeTree = ensureSyntaxTree(
      handle.view.state,
      handle.view.state.doc.length,
      100,
    ) ?? syntaxTree(handle.view.state);
    completeTree.iterate({
      enter(node) {
        if (node.name === "Table") tables += 1;
        if (node.name === "FencedCode") fencedCode += 1;
      },
    });
    expect(tables).toBeGreaterThan(0);
    expect(fencedCode).toBeGreaterThan(0);

    const mermaid = sampleMarkdown.match(/```mermaid[\s\S]*?```/)?.[0];
    const table = sampleMarkdown.match(/^\| 组件 \|[\s\S]*?^\| 表格编辑[^\n]*$/m)?.[0];
    expect(mermaid).toBeTruthy();
    expect(table).toBeTruthy();
    expect(mount(mermaid!).parent.querySelector(".md-mermaid-widget")).not.toBeNull();
    const tableParent = mount(table!).parent;
    expect(tableParent.querySelector(".md-table-widget")).not.toBeNull();
    expect(tableParent.textContent).not.toContain("| --- | --- |");
  });

  it("renders CommonMark/GFM block and inline constructs without exposing their source", () => {
    const { parent } = mount([
      "Reference [OpenAI][site] and entity &copy;.",
      "",
      "![Logo][logo]",
      "",
      "[site]: https://openai.com \"OpenAI\"",
      "[logo]: https://example.com/logo.png \"Logo title\"",
      "",
      "Footnote[^note].",
      "",
      "[^note]: explanation",
      "",
      "<div><strong>HTML preview</strong></div>",
      "",
      "    const answer = 42;",
      "",
      "H~2~O and x^2^",
    ].join("\n"));

    expect(parent.querySelector(".md-metadata-reference")?.textContent).toContain("site → https://openai.com");
    expect(parent.querySelector(".md-metadata-footnote")?.textContent).toContain("Footnote 1 · explanation");
    expect(parent.querySelector("sup.cm-md-footnote")?.textContent).toBe("1");
    expect(parent.querySelector(".md-html-preview")?.textContent).toContain("HTML preview");
    expect(parent.querySelector(".md-codeblock-widget")?.textContent).toContain("const answer = 42;");
    expect(parent.querySelector(".md-entity")?.textContent).toBe("©");
    expect(parent.querySelector(".md-sub")?.textContent).toBe("2");
    expect(parent.querySelector(".md-sup")?.textContent).toBe("2");
    expect(parent.querySelector<HTMLImageElement>(".md-image-widget img")?.title).toBe("Logo title");
  });

  it("renders the bundled inline and block math instead of dollar source", () => {
    const math = [
      "行内公式：质能方程 $E = mc^2$，勾股定理 $a^2 + b^2 = c^2$。",
      "",
      "$$",
      "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
      "$$",
    ].join("\n");
    const { parent } = mount(math);

    expect(parent.querySelectorAll(".md-math-inline .katex")).toHaveLength(2);
    const block = parent.querySelector<HTMLElement>(".md-math-block");
    expect(block).not.toBeNull();
    expect(block?.innerHTML).toContain("class=\"katex");
    expect(parent.textContent).not.toContain("$$");
  });

  it("keeps consecutive block formulas rendered when the editor selection enters them", () => {
    const math = [
      "$$",
      "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
      "$$",
      "",
      "$$",
      "\\begin{aligned}",
      "f(x) &= a x^2 + b x + c \\\\",
      "f'(x) &= 2 a x + b",
      "\\end{aligned}",
      "$$",
    ].join("\n");
    const { parent, handle } = mount(math);
    const assertRendered = () => {
      expect(parent.querySelectorAll(".md-math-block")).toHaveLength(2);
      expect(parent.querySelectorAll(".md-math-empty")).toHaveLength(0);
      expect(parent.textContent).not.toContain("$$");
    };

    assertRendered();
    handle.view.dispatch({ selection: { anchor: math.indexOf("\\int") + 2 } });
    assertRendered();
    handle.view.dispatch({ selection: { anchor: math.indexOf("\\begin") + 2 } });
    assertRendered();
  });

  it("exits a code block when Enter is pressed on its trailing blank line", async () => {
    const { parent, handle } = mount("```javascript\nconst answer = 42;\n```");
    const code = parent.querySelector<HTMLElement>(".md-codeblock-widget code")!;
    code.focus();
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(code);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    code.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));

    // happy-dom 不执行 contenteditable 的原生换行，这里模拟第一次 Enter 的结果。
    code.textContent = "const answer = 42;\n";
    range.selectNodeContents(code);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    code.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await nextFrame();

    code.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));

    expect(handle.view.state.doc.toString()).toBe(
      "```javascript\nconst answer = 42;\n```\n",
    );
    expect(handle.view.state.selection.main.head).toBe(handle.view.state.doc.length);
    expect(handle.view.hasFocus).toBe(true);
  });

  it("shows sequential line numbers in code blocks", () => {
    const { parent } = mount("```text\none\ntwo\nthree\nfour\n```");
    expect(parent.querySelector(".md-codeblock-gutter")?.textContent).toBe("1\n2\n3\n4");
  });

  it("selects only the active component when Ctrl+A is pressed", () => {
    const { parent } = mount("```text\none\ntwo\n```\n\nafter");
    const code = parent.querySelector<HTMLElement>(".md-codeblock-widget code")!;
    code.focus();

    const event = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    code.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(window.getSelection()?.toString()).toBe("one\ntwo");
    expect(window.getSelection()?.toString()).not.toContain("after");
  });

  it("styles a revealed heading marker separately from heading text", () => {
    const { parent } = mount("### Heading");
    const marker = parent.querySelector<HTMLElement>(".cm-md-heading-mark");
    expect(marker?.textContent).toBe("###");
    expect(marker?.classList.contains("cm-md-heading-mark")).toBe(true);
  });

  it("compresses structural and repeated Markdown blank lines in preview", () => {
    const { parent } = mount("First paragraph\n\n\nSecond paragraph\n\n# Heading");
    expect(parent.querySelectorAll(".cm-line.md-blank-line")).toHaveLength(3);
    expect(parent.querySelectorAll(".cm-line.md-blank-line-extra")).toHaveLength(1);
  });

  it("keeps copy at the code block top-right and moves language to its own control", () => {
    const { parent } = mount("```typescript\nconst value = 1;\n```");
    const block = parent.querySelector<HTMLElement>(".md-codeblock-widget")!;
    expect(block.querySelector(".md-codeblock-header > .md-codeblock-copy")).not.toBeNull();
    expect(block.querySelector(".md-codeblock-header > .md-codeblock-lang")).toBeNull();
    expect(block.querySelector(".md-codeblock-box > .md-codeblock-language-control > .md-codeblock-lang")).not.toBeNull();
  });

  it("sanitizes executable raw HTML in the live preview", () => {
    const { parent } = mount([
      "<div>",
      "<script>window.__unsafe = true</script>",
      "<a href=\"javascript:alert(1)\" onclick=\"alert(1)\">safe text</a>",
      "</div>",
    ].join("\n"));

    const preview = parent.querySelector<HTMLElement>(".md-html-preview")!;
    expect(preview.querySelector("script")).toBeNull();
    expect(preview.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(preview.querySelector("a")?.hasAttribute("onclick")).toBe(false);
    expect(preview.textContent).toContain("safe text");
  });

  it("switches a preview block to source editing and writes changes back", async () => {
    const { parent, handle, onChange } = mount("[^note]: old text");
    const preview = parent.querySelector<HTMLElement>(".md-metadata-preview");
    expect(preview).not.toBeNull();

    preview!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    const wrap = parent.querySelector<HTMLElement>(".md-metadata-widget")!;
    const source = wrap.querySelector<HTMLElement>(".md-block-source")!;
    expect(wrap.classList.contains("md-block--editing")).toBe(true);
    expect(document.activeElement).toBe(source);

    source.dispatchEvent(new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(window.getSelection()?.toString()).toBe("[^note]: old text");

    source.textContent = "[^note]: new text";
    source.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await nextFrame();
    expect(handle.view.state.doc.toString()).toBe("[^note]: new text");
    expect(onChange).toHaveBeenLastCalledWith("[^note]: new text");

    source.blur();
    await nextFrame();
    expect(wrap.classList.contains("md-block--editing")).toBe(false);
  });

  it("keeps GFM tables rendered and edits cells in place", async () => {
    const markdown = [
      "| Component | Status |",
      "| --- | --- |",
      "| Preview | Ready |",
    ].join("\n");
    const { parent, handle } = mount(markdown);
    const table = parent.querySelector<HTMLElement>(".md-table-widget table");
    const cell = table?.querySelector<HTMLElement>("tbody td");

    expect(table).not.toBeNull();
    expect(parent.textContent).not.toContain("| --- |");
    expect(cell?.contentEditable).toBe("true");

    handle.setMode("source");
    handle.view.dispatch({ selection: { anchor: 5 } });
    handle.setMode("preview");
    expect(parent.querySelector(".md-table-widget table")).not.toBeNull();

    const editableCell = parent.querySelector<HTMLElement>(".md-table-widget tbody td")!;
    editableCell.focus();
    editableCell.dispatchEvent(new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(parent.querySelectorAll(".md-table-cell-selected")).toHaveLength(4);
    editableCell.textContent = "Editor";
    editableCell.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await nextFrame();
    expect(handle.view.state.doc.toString()).toContain("| Editor");
    expect(parent.querySelector(".md-table-widget")).not.toBeNull();
  });

  it("aligns the whole table without a range and selected columns with a range", () => {
    const { parent, handle } = mount([
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n"));
    const wrap = parent.querySelector<HTMLElement>(".md-table-widget")!;
    const firstCell = wrap.querySelector<HTMLElement>("tbody td")!;
    firstCell.focus();

    wrap.querySelector<HTMLElement>('[data-action="align-center"]')!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    expect(handle.view.state.doc.line(2).text).toBe("| :---: | :---: |");

    const secondHeader = wrap.querySelectorAll<HTMLElement>("thead th")[1];
    const secondBody = wrap.querySelectorAll<HTMLElement>("tbody td")[1];
    secondHeader.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    secondBody.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    secondBody.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    wrap.querySelector<HTMLElement>('[data-action="align-right"]')!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));

    expect(handle.view.state.doc.line(2).text).toBe("| :---: | ---: |");
  });
});
