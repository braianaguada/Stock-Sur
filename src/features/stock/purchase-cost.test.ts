import { describe, expect, it } from "vitest";
import { purchaseCostFields } from "./purchase-cost";
import type { StockMovementForm } from "./types";

const form: StockMovementForm = {
  item_id: "item", type: "IN", adjustment_direction: "ADD", quantity: "10", reference: "",
};

describe("purchase cost snapshots", () => {
  it("preserves independent purchase costs and trims the supplier", () => {
    expect(purchaseCostFields({ ...form, unit_cost_ars: "550", purchase_supplier: " A " }))
      .toEqual({ unit_cost_ars: 550, purchase_supplier: "A" });
    expect(purchaseCostFields({ ...form, unit_cost_ars: "450" }).unit_cost_ars).toBe(450);
  });
  it("distinguishes an unknown cost from a free purchase", () => {
    expect(purchaseCostFields({ ...form, unit_cost_ars: " " }).unit_cost_ars).toBeNull();
    expect(purchaseCostFields({ ...form, unit_cost_ars: "0" }).unit_cost_ars).toBe(0);
  });
  it.each(["-1", "NaN", "Infinity", "abc"])("rejects invalid cost %s", (cost) => {
    expect(() => purchaseCostFields({ ...form, unit_cost_ars: cost })).toThrow(/costo unitario/);
  });
  it.each(["OUT", "ADJUSTMENT"] as const)("does not send stale costs on %s removals", (type) => {
    expect(purchaseCostFields({ ...form, type, adjustment_direction: "REMOVE", unit_cost_ars: "550", purchase_supplier: "A" }))
      .toEqual({ unit_cost_ars: null, purchase_supplier: null });
  });
});
