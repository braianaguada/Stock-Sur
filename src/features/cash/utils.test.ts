import { describe, expect, it } from "vitest";
import { shouldAutoCloseCashClosure } from "./utils";

describe("cash auto close", () => {
  it("closes once the configured time is reached", () => {
    const result = shouldAutoCloseCashClosure({
      enabled: true,
      configuredTime: "18:30",
      businessDate: "2026-05-05",
      todayBusinessDate: "2026-05-05",
      currentHour: 18,
      currentMinute: 31,
      closureId: "closure-1",
      triggeredKey: null,
    });

    expect(result).toEqual({
      shouldClose: true,
      nextTriggeredKey: "2026-05-05:closure-1:18:30",
    });
  });

  it("does not close before the configured time or twice for the same closure", () => {
    const first = shouldAutoCloseCashClosure({
      enabled: true,
      configuredTime: "18:30",
      businessDate: "2026-05-05",
      todayBusinessDate: "2026-05-05",
      currentHour: 18,
      currentMinute: 29,
      closureId: "closure-1",
      triggeredKey: null,
    });

    const second = shouldAutoCloseCashClosure({
      enabled: true,
      configuredTime: "18:30",
      businessDate: "2026-05-05",
      todayBusinessDate: "2026-05-05",
      currentHour: 18,
      currentMinute: 31,
      closureId: "closure-1",
      triggeredKey: "2026-05-05:closure-1:18:30",
    });

    expect(first.shouldClose).toBe(false);
    expect(second.shouldClose).toBe(false);
  });
});
