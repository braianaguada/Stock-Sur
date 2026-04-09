import { describe, expect, it } from "vitest";
import { buildStockInsights, countStockInsightTones } from "@/features/stock/insights";
import type { StockRow } from "@/features/stock/types";

function makeRow(overrides: Partial<StockRow>): StockRow {
  return {
    item_id: "item-1",
    item_name: "Item",
    item_sku: "SKU",
    item_unit: "un",
    total: 10,
    avg_daily_out_30d: 1,
    avg_daily_out_90d: 1,
    avg_daily_out_365d: 1,
    demand_daily: 1,
    days_of_cover: 10,
    months_of_cover_low_rotation: null,
    health: "YELLOW",
    low_rotation: false,
    demand_profile: "MEDIUM",
    demand_monthly_estimate: null,
    ...overrides,
  };
}

describe("stock insights", () => {
  it("prioritizes stockout and low coverage risks", () => {
    const insights = buildStockInsights([
      makeRow({
        item_id: "critical",
        item_name: "Cable 2x1",
        total: 0,
        days_of_cover: 0,
        health: "RED",
      }),
      makeRow({
        item_id: "warn",
        item_name: "Valvula 1/2",
        total: 8,
        days_of_cover: 6,
        health: "RED",
      }),
    ]);

    expect(insights[0]?.kind).toBe("STOCKOUT");
    expect(insights[1]?.kind).toBe("LOW_COVERAGE");
  });

  it("detects demand spikes and low rotation overstock", () => {
    const insights = buildStockInsights([
      makeRow({
        item_id: "spike",
        item_name: "Presostato",
        total: 30,
        days_of_cover: 14,
        avg_daily_out_30d: 3.4,
        avg_daily_out_90d: 1.2,
        avg_daily_out_365d: 0.9,
      }),
      makeRow({
        item_id: "over",
        item_name: "Filtro especial",
        total: 25,
        health: "GREEN",
        low_rotation: true,
        demand_profile: "LOW",
        days_of_cover: null,
        months_of_cover_low_rotation: 28,
        avg_daily_out_30d: 0,
        avg_daily_out_90d: 0.1,
        avg_daily_out_365d: 0.2,
      }),
    ]);

    expect(insights.some((insight) => insight.kind === "DEMAND_SPIKE")).toBe(true);
    expect(insights.some((insight) => insight.kind === "OVERSTOCK")).toBe(true);
  });

  it("counts tones for dashboard summaries", () => {
    const insights = buildStockInsights([
      makeRow({ item_id: "red", total: 0, health: "RED" }),
      makeRow({ item_id: "yellow", total: 5, days_of_cover: 12, health: "YELLOW" }),
      makeRow({
        item_id: "blue",
        total: 15,
        avg_daily_out_30d: 0,
        avg_daily_out_90d: 0,
        avg_daily_out_365d: 0,
        demand_daily: 0,
        days_of_cover: null,
        health: "GREEN",
      }),
    ]);

    const counts = countStockInsightTones(insights);
    expect(counts.RED).toBe(1);
    expect(counts.YELLOW).toBe(1);
    expect(counts.BLUE).toBe(1);
  });
});
