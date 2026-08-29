import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleIdleTask } from "./startup";

describe("scheduleIdleTask", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses requestIdleCallback when available", () => {
    const task = vi.fn();
    const requestIdleCallback = vi.fn(() => 42);
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    scheduleIdleTask(task, 750);

    expect(requestIdleCallback).toHaveBeenCalledWith(task, { timeout: 750 });
  });

  it("falls back to a timer when idle callbacks are unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();

    scheduleIdleTask(task);
    expect(task).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(task).toHaveBeenCalledOnce();
  });

  it("cancels scheduled idle work", () => {
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", vi.fn(() => 17));
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

    const cancel = scheduleIdleTask(vi.fn());
    cancel();

    expect(cancelIdleCallback).toHaveBeenCalledWith(17);
  });
});
