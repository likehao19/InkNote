import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditor } from "./editor";

describe("outline jump highlight", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("highlights the jumped line, retriggers on repeated jumps, and clears automatically", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.appendChild(host);

    const handle = createEditor(host, "# First\n\nParagraph\n\n## Target Heading\n\nBody", {
      mode: "preview",
      filePath: null,
      typewriter: false,
      lineNumbers: false,
      wordWrap: true,
      tabSize: 2,
      spellCheck: false,
      readOnly: true,
      onChange: () => {},
      onModeChange: () => {},
    });

    handle.scrollToLine(5);
    const firstHit = host.querySelector(".cm-line.cm-jump-highlight");
    expect(firstHit).not.toBeNull();
    expect(firstHit?.textContent).toContain("Target Heading");
    const firstVariant = firstHit?.classList.contains("cm-jump-highlight--b") ? "b" : "a";

    // Jumping to the same line again swaps the animation variant so CSS replays the flash
    handle.scrollToLine(5);
    const secondHit = host.querySelector(".cm-line.cm-jump-highlight");
    expect(secondHit).not.toBeNull();
    expect(secondHit?.classList.contains(`cm-jump-highlight--${firstVariant === "a" ? "b" : "a"}`)).toBe(true);

    // Clears automatically after the animation finishes
    vi.advanceTimersByTime(1900);
    expect(host.querySelector(".cm-line.cm-jump-highlight")).toBeNull();

    handle.destroy();
  });
});
