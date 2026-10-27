import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { summarizeStockCostLots, type StockCostLot } from "./cost-lots";

describe("stock purchase valuation", () => {
  it("values remaining purchases separately and discloses unknown costs and shortages", () => {
    const lot = (cost: number | null, remaining: number): StockCostLot => ({
      id: "lot", acquired_at: "2026-10-27", kind: "PURCHASE", supplier: null,
      unit_cost_ars: cost, received_quantity: 10, remaining_quantity: remaining,
      remaining_value_ars: cost === null ? null : cost * remaining,
    });
    expect(summarizeStockCostLots([lot(550, 3), lot(450, 8), lot(null, 2), lot(0, 4), lot(null, -1)]))
      .toEqual({ knownValue: 5250, unvaluedQuantity: 2, shortageQuantity: 1 });
  });
});
