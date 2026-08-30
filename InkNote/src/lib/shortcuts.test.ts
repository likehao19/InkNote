import { beforeEach, describe, expect, it } from "vitest";
import {
  eventToShortcut,
  getDefaultShortcutMap,
  getShortcutMap,
  isValidAppShortcut,
  matchesShortcut,
  setShortcutMap,
  shortcutConflict,
} from "./shortcuts";
import { resetSettingsStoreForTests } from "./settingsStore";

function keyEvent(key: string, init: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent("keydown", { key, ...init });
}

describe("app shortcuts", () => {
  beforeEach(() => resetSettingsStoreForTests());

  it("uses defaults and persists customized mappings", () => {
    const shortcuts = getDefaultShortcutMap();
    shortcuts.save = "Mod+Shift+P";
    setShortcutMap(shortcuts);
    expect(getShortcutMap().save).toBe("Mod+Shift+P");
  });

  it("normalizes keyboard events and matches exact modifiers", () => {
    const event = keyEvent("S", { ctrlKey: true, shiftKey: true });
    expect(eventToShortcut(event)).toBe("Mod+Shift+S");
    expect(matchesShortcut(event, "Mod+Shift+S")).toBe(true);
    expect(matchesShortcut(event, "Mod+S")).toBe(false);
  });

  it("uses physical letter keys when Alt changes the produced character", () => {
    const event = keyEvent("ƒ", { code: "KeyF", ctrlKey: true, altKey: true });
    expect(eventToShortcut(event)).toBe("Mod+Alt+F");
  });

  it("normalizes the shifted plus key as zoom in", () => {
    const event = keyEvent("+", { code: "Equal", ctrlKey: true, shiftKey: true });
    expect(eventToShortcut(event)).toBe("Mod+=");
  });

  it("requires a modifier for regular keys but permits function keys", () => {
    expect(isValidAppShortcut("A")).toBe(false);
    expect(isValidAppShortcut("Shift+A")).toBe(false);
    expect(isValidAppShortcut("Mod+A")).toBe(true);
    expect(isValidAppShortcut("F8")).toBe(true);
  });

  it("finds conflicts with another action", () => {
    const shortcuts = getDefaultShortcutMap();
    expect(shortcutConflict(shortcuts, "open", shortcuts.save)).toBe("save");
    expect(shortcutConflict(shortcuts, "save", shortcuts.save)).toBeNull();
  });
});
