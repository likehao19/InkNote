import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import UpdateProgress from "./UpdateProgress";

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("UpdateProgress", () => {
  it("keeps rendering the current download after an application rerender", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const state = {
      phase: "downloading" as const,
      version: "0.2.2",
      percent: 72,
      downloaded: 72,
      total: 100,
    };

    act(() => root?.render(<UpdateProgress locale="zh" state={state} />));
    act(() => root?.render(<UpdateProgress locale="zh" state={state} />));

    const progress = host.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-valuenow")).toBe("72");
    expect(host.textContent).toContain("72%");
  });
});
