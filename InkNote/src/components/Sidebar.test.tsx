import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

describe("recent files context menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderSidebar(callbacks: {
    onOpenPath?: (path: string) => void;
    onRemoveRecent?: (path: string) => void;
    onDeletePath?: (path: string, isDir: boolean) => boolean | Promise<boolean>;
  } = {}) {
    act(() => {
      root.render(
        <Sidebar
          locale="zh"
          tab="recent"
          onTab={() => {}}
          folderPaths={[]}
          onOpenPath={callbacks.onOpenPath ?? (() => {})}
          onDeletePath={callbacks.onDeletePath}
          outline={[]}
          activeOutlineLine={null}
          onOutlineClick={() => {}}
          currentPath={null}
          recentFiles={["/tmp/recent.md"]}
          onRemoveRecent={callbacks.onRemoveRecent ?? (() => {})}
        />,
      );
    });
  }

  function openContextMenu() {
    const recentItem = container.querySelector(".recent-item");
    expect(recentItem).not.toBeNull();
    act(() => {
      recentItem?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: 24,
        clientY: 36,
      }));
    });
  }

  function menuButton(label: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>(".context-menu-item"))
      .find((item) => item.textContent?.includes(label));
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  it("shows file actions for a recent file and opens it", () => {
    const onOpenPath = vi.fn();
    renderSidebar({ onOpenPath, onDeletePath: vi.fn() });

    openContextMenu();

    expect(menuButton("打开")).toBeTruthy();
    expect(menuButton("复制绝对路径")).toBeTruthy();
    expect(menuButton("在资源管理器中显示")).toBeTruthy();
    expect(menuButton("删除")).toBeTruthy();
    expect(menuButton("从最近列表移除")).toBeTruthy();

    act(() => menuButton("打开").click());
    expect(onOpenPath).toHaveBeenCalledWith("/tmp/recent.md");
  });

  it("removes only the selected recent entry", () => {
    const onRemoveRecent = vi.fn();
    renderSidebar({ onRemoveRecent });

    openContextMenu();
    act(() => menuButton("从最近列表移除").click());

    expect(onRemoveRecent).toHaveBeenCalledWith("/tmp/recent.md");
  });

  it("routes deletion through the existing file deletion flow", () => {
    const onDeletePath = vi.fn(() => true);
    renderSidebar({ onDeletePath });

    openContextMenu();
    act(() => menuButton("删除").click());

    expect(onDeletePath).toHaveBeenCalledWith("/tmp/recent.md", false);
  });
});

describe("outline hierarchy", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders heading levels with data-level attributes and navigates on click", () => {
    const onOutlineClick = vi.fn();
    act(() => {
      root.render(
        <Sidebar
          locale="zh"
          tab="outline"
          onTab={() => {}}
          folderPaths={[]}
          onOpenPath={() => {}}
          outline={[
            { level: 1, text: "总览", line: 1 },
            { level: 2, text: "1. 背景", line: 5 },
            { level: 3, text: "1.1 细节说明", line: 12 },
          ]}
          activeOutlineLine={5}
          onOutlineClick={onOutlineClick}
          currentPath={null}
          recentFiles={[]}
          onRemoveRecent={() => {}}
        />,
      );
    });

    const items = Array.from(container.querySelectorAll<HTMLLIElement>(".outline-item"));
    expect(items).toHaveLength(3);
    expect(items[0].dataset.level).toBe("1");
    expect(items[1].dataset.level).toBe("2");
    expect(items[1].classList.contains("active")).toBe(true);
    expect(items[2].dataset.level).toBe("3");

    act(() => items[2].click());
    expect(onOutlineClick).toHaveBeenCalledWith(12);
  });
});
