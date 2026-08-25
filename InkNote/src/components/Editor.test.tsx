import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Editor, { type EditorRef } from "./Editor";

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("Editor document replacement", () => {
  it("clamps the selection to CodeMirror's normalized CRLF document length", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const ref = createRef<EditorRef>();
    const onChange = vi.fn();
    const render = (value: string) => (
      <Editor
        ref={ref}
        locale="en"
        value={value}
        mode="preview"
        filePath={null}
        typewriter={false}
        lineNumbers={false}
        wordWrap
        tabSize={2}
        spellCheck={false}
        readOnly={false}
        onChange={onChange}
        onModeChange={() => {}}
      />
    );

    act(() => root?.render(render(Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n"))));
    act(() => ref.current?.scrollToLine(20));

    expect(() => {
      act(() => root?.render(render("one\r\ntwo")));
    }).not.toThrow();
  });
});
