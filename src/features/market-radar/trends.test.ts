import { describe, expect, it } from "vitest";
import { buildItemTrends, classifyTrend } from "./trends";

describe("market radar trends", () => {
  it("avoids strong signals for negligible volume", () => {
    expect(classifyTrend(2, 0)).toBe("LOW_VOLUME");
    expect(classifyTrend(1, 2)).toBe("LOW_VOLUME");
  });

  it("classifies material changes with a 25 percent threshold", () => {
    expect(classifyTrend(10, 5)).toBe("RISING");
    expect(classifyTrend(5, 10)).toBe("FALLING");
    expect(classifyTrend(11, 10)).toBe("STABLE");
  });

  it("aggregates only the current and previous 30-day windows", () => {
    const asOf = new Date("2026-08-13T12:00:00.000Z");
    const trends = buildItemTrends(
      [{ id: "a", name: "Filtro", sku: "F-1", unit: "UN" }],
      [
        { item_id: "a", quantity: 4, created_at: "2026-08-10T12:00:00.000Z" },
        { item_id: "a", quantity: 2, created_at: "2026-07-20T12:00:00.000Z" },
        { item_id: "a", quantity: 2, created_at: "2026-07-01T12:00:00.000Z" },
        { item_id: "a", quantity: 99, created_at: "2026-06-01T12:00:00.000Z" },
      ],
      asOf,
    );

    expect(trends[0]).toMatchObject({ currentUnits: 6, previousUnits: 2, signal: "RISING" });
  });
});
