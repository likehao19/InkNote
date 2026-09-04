import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { createEditor, type EditorHandle } from "./editor";
import sampleMarkdown from "../sample.md?raw";

const handles: EditorHandle[] = [];

function mount(markdown: string, readOnly = false) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const onChange = vi.fn();
  const onModeChange = vi.fn();
  const handle = createEditor(parent, markdown, {
    mode: "preview",
    filePath: null,
    typewriter: false,
    lineNumbers: false,
    wordWrap: true,
    tabSize: 2,
    spellCheck: false,
    readOnly,
    onChange,
    onModeChange,
  });
  handles.push(handle);
  return { parent, handle, onChange, onModeChange };
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
    expect(sampleMarkdown).not.toContain("\b");
    expect(sampleMarkdown).toContain("\\begin{aligned}");
    expect(sampleMarkdown).toContain("\\end{aligned}");
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
    expect(parent.querySelector(".md-metadata-footnote")?.textContent).toContain("脚注 1 · explanation");
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

  it("marks every Markdown blank line without dropping repeated empty paragraphs", () => {
    const { parent } = mount("First paragraph\n\n\nSecond paragraph\n\n# Heading");
    expect(parent.querySelectorAll(".cm-line.md-blank-line")).toHaveLength(3);
    expect(parent.querySelectorAll(".cm-line.md-blank-line-extra")).toHaveLength(1);
  });

  it("skips hidden source blank lines on both sides of a horizontal rule", () => {
    const markdown = "Before\n\n---\n\nAfter";
    const { parent, handle } = mount(markdown);
    const rule = parent.querySelector<HTMLElement>(".md-hr-widget")!;
    const line = rule.querySelector<HTMLElement>(".md-hr-line")!;
    line.getBoundingClientRect = () => ({
      x: 0,
      y: 10,
      top: 10,
      right: 100,
      bottom: 11,
      left: 0,
      width: 100,
      height: 1,
      toJSON: () => ({}),
    });

    rule.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: 5 }));
    expect(handle.view.state.selection.main.head).toBe("Before".length);
    expect(document.activeElement).not.toBe(rule);

    rule.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: 16 }));
    expect(handle.view.state.selection.main.head).toBe(markdown.indexOf("After"));
    expect(document.activeElement).not.toBe(rule);
  });

  it("allocates enough marker space for multi-digit ordered lists", () => {
    const { parent } = mount("9. Nine\n10. Ten\n11. Eleven\n99. Ninety-nine");
    const lines = Array.from(parent.querySelectorAll<HTMLElement>(".cm-line.md-ordered-list"));
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.style.getPropertyValue("--md-marker").trim())).toEqual([
      '"9."',
      '"10."',
      '"11."',
      '"99."',
    ]);
    expect(Number.parseFloat(lines[1].style.getPropertyValue("--md-list-marker-width"))).toBeGreaterThan(1.35);
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

  it("aligns the whole table without a range and only selected cells with a range", () => {
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

    expect(handle.view.state.doc.line(1).text).toContain("<!--inknote-align:right-->B");
    expect(handle.view.state.doc.line(2).text).toBe("| :---: | :---: |");
    expect(handle.view.state.doc.line(3).text).toContain("<!--inknote-align:right-->2");
    expect(wrap.querySelectorAll<HTMLElement>("thead th")[1].style.textAlign).toBe("right");
    expect(wrap.querySelectorAll<HTMLElement>("tbody td")[0].style.textAlign).toBe("center");
  });

  it("creates a visible editable paragraph when Enter is pressed between block widgets", () => {
    const markdown = [
      "---",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");
    const { parent, handle } = mount(markdown);
    const table = parent.querySelector<HTMLElement>(".md-table-widget")!;
    const tableFrom = handle.view.posAtDOM(table);
    handle.view.dispatch({ selection: { anchor: tableFrom } });

    handle.view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));

    expect(handle.view.state.doc.toString()).toContain("---\n\n\n| A | B |");
    const activeLine = parent.querySelector<HTMLElement>(".cm-line.cm-activeLine");
    expect(activeLine?.classList.contains("md-blank-line")).toBe(true);
  });

  it("creates and focuses a blank paragraph before a heading", () => {
    const markdown = "Paragraph\n\n## 七、代码块";
    const { parent, handle } = mount(markdown);
    const headingFrom = markdown.indexOf("##");
    handle.view.dispatch({ selection: { anchor: headingFrom } });
    handle.view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));

    expect(handle.view.state.doc.toString()).toBe("Paragraph\n\n\n## 七、代码块");
    expect(handle.view.state.selection.main.head).toBe(headingFrom);
    expect(parent.querySelector(".cm-line.cm-activeLine")?.classList.contains("md-blank-line")).toBe(true);
  });

  it("toggles a nested task by clicking its visually indented checkbox", () => {
    const markdown = "- [ ] Parent\n  - [ ] Nested task";
    const { parent, handle } = mount(markdown);
    const nested = parent.querySelectorAll<HTMLElement>(".cm-line.md-task-item")[1];
    nested.style.paddingLeft = "80px";
    nested.style.fontSize = "16px";
    nested.style.setProperty("--editor-list-marker-offset", "1.35em");
    nested.getBoundingClientRect = () => ({
      x: 0,
      y: 20,
      top: 20,
      right: 400,
      bottom: 40,
      left: 0,
      width: 400,
      height: 20,
      toJSON: () => ({}),
    });

    nested.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      button: 0,
      clientX: 64,
      clientY: 30,
    }));

    expect(handle.view.state.doc.toString()).toContain("  - [x] Nested task");
  });

  it("renders and toggles a standalone checked task shorthand", () => {
    const { parent, handle } = mount("[x] Completed task");
    const line = parent.querySelector<HTMLElement>(".cm-line.md-task-item.md-task-done")!;
    expect(line).not.toBeNull();
    expect(line.textContent).toBe("Completed task");
    line.style.paddingLeft = "40px";
    line.style.fontSize = "16px";
    line.style.setProperty("--editor-list-marker-offset", "1.35em");
    line.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      right: 400,
      bottom: 20,
      left: 0,
      width: 400,
      height: 20,
      toJSON: () => ({}),
    });
    line.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 10,
    }));
    expect(handle.view.state.doc.toString()).toBe("[ ] Completed task");
  });

  it("includes header cells in one continuous rectangular table selection", () => {
    const { parent } = mount([
      "| A | B | C |",
      "| --- | --- | --- |",
      "| 1 | 2 | 3 |",
      "| 4 | 5 | 6 |",
    ].join("\n"));
    const wrap = parent.querySelector<HTMLElement>(".md-table-widget")!;
    const firstHeader = wrap.querySelectorAll<HTMLElement>("thead th")[0];
    const secondBodyCell = wrap.querySelectorAll<HTMLElement>("tbody td")[1];

    firstHeader.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    secondBodyCell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    secondBodyCell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));

    const selected = Array.from(wrap.querySelectorAll<HTMLElement>(".md-table-cell-selected"));
    expect(selected).toHaveLength(4);
    expect(selected.filter((cell) => cell.tagName === "TH")).toHaveLength(2);
    expect(selected.filter((cell) => cell.tagName === "TD")).toHaveLength(2);
  });

  it("rejects document mutations while the editor is in read-only preview", () => {
    const { handle } = mount("read only");
    handle.setReadOnly(true);
    handle.view.dispatch({ changes: { from: 0, to: 4, insert: "edit" } });
    expect(handle.view.state.doc.toString()).toBe("read only");

    handle.setReadOnly(false);
    handle.view.dispatch({ changes: { from: 0, to: 4, insert: "edit" } });
    expect(handle.view.state.doc.toString()).toBe("edit only");
  });

  it("keeps Markdown syntax hidden while allowing task toggles in read-only preview", () => {
    const markdown = "### Release checklist\n\n- [ ] Publish packages";
    const { parent, handle } = mount(markdown, true);

    handle.view.dispatch({ selection: { anchor: 5 } });
    expect(parent.textContent).not.toContain("###");

    const task = parent.querySelector<HTMLElement>(".cm-line.md-task-item")!;
    task.style.paddingLeft = "40px";
    task.style.fontSize = "16px";
    task.style.setProperty("--editor-list-marker-offset", "1.35em");
    task.getBoundingClientRect = () => ({
      x: 0,
      y: 20,
      top: 20,
      right: 400,
      bottom: 40,
      left: 0,
      width: 400,
      height: 20,
      toJSON: () => ({}),
    });
    task.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 30,
    }));

    expect(handle.view.state.doc.toString()).toContain("- [x] Publish packages");
    expect(parent.textContent).not.toContain("###");
  });

  it("keeps block components rendered and non-editable throughout read-only preview", () => {
    const markdown = [
      "## Architecture",
      "",
      "> Stable release notes",
      "",
      "Inline formula $E = mc^2$.",
      "",
      "$$",
      "x^2 + y^2 = z^2",
      "$$",
      "",
      "```typescript",
      "const ready = true;",
      "```",
      "",
      "| Component | State |",
      "| --- | --- |",
      "| Preview | Ready |",
    ].join("\n");
    const { parent, handle } = mount(markdown, true);

    for (const anchor of [
      markdown.indexOf("Architecture"),
      markdown.indexOf("Stable"),
      markdown.indexOf("E ="),
      markdown.indexOf("x^2"),
      markdown.indexOf("const ready"),
      markdown.indexOf("Component"),
    ]) {
      handle.view.dispatch({ selection: { anchor } });
    }

    expect(parent.querySelector(".md-math-block .katex")).not.toBeNull();
    expect(parent.querySelector(".md-codeblock-widget code")?.textContent).toContain("const ready = true;");
    expect(parent.querySelector(".md-codeblock-copy")).not.toBeNull();
    expect(parent.querySelector(".md-table-widget table")).not.toBeNull();
    expect(parent.textContent).not.toContain("##");
    expect(parent.textContent).not.toContain("$$");
    expect(parent.textContent).not.toContain("```");
    expect(parent.textContent).not.toContain("| --- | --- |");

    const code = parent.querySelector<HTMLElement>(".md-codeblock-widget code")!;
    const cell = parent.querySelector<HTMLElement>(".md-table-widget tbody td")!;
    code.dispatchEvent(new InputEvent("input", { bubbles: true }));
    cell.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(handle.view.state.doc.toString()).toBe(markdown);
  });

  it("forces source mode back to preview when read-only is enabled", () => {
    const { parent, handle, onModeChange } = mount("## Protected heading");

    handle.setMode("source");
    expect(parent.textContent).toContain("##");

    handle.setReadOnly(true);
    expect(onModeChange).toHaveBeenLastCalledWith("preview");
    expect(parent.textContent).not.toContain("##");

    handle.setMode("source");
    expect(parent.textContent).not.toContain("##");
  });

  it("allows native text selection in a read-only table without editing it", () => {
    const markdown = [
      "| Name | State |",
      "| --- | --- |",
      "| Preview | Ready |",
    ].join("\n");
    const { parent, handle } = mount(markdown, true);
    const cell = parent.querySelector<HTMLElement>(".md-table-widget tbody td")!;
    const event = new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true });

    cell.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(cell.contentEditable).toBe("false");
    expect(handle.view.state.doc.toString()).toBe(markdown);
  });

  it("allows selecting and copying part of a read-only code block", () => {
    const markdown = "```typescript\nconst ready = true;\nconst count = 2;\n```";
    const { parent, handle } = mount(markdown, true);
    const code = parent.querySelector<HTMLElement>(".md-codeblock-widget code")!;
    const pointer = new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true });
    const copy = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "c" });
    const selectAll = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "a" });

    code.dispatchEvent(pointer);
    code.dispatchEvent(copy);
    code.dispatchEvent(selectAll);

    expect(pointer.defaultPrevented).toBe(false);
    expect(copy.defaultPrevented).toBe(false);
    expect(selectAll.defaultPrevented).toBe(true);
    expect(window.getSelection()?.toString()).toBe("const ready = true;\nconst count = 2;");
    expect(handle.view.state.doc.toString()).toBe(markdown);
  });
});
