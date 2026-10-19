import { describe, expect, it } from "vitest";
import { groupStockAlerts } from "./alert-presentation";
import { buildStockRows } from "./stockRows";
import type { StockInsight } from "./insights";

function alert(id: string, kind: StockInsight["kind"] = "STOCKOUT"): StockInsight {
  return { id, itemId: id, itemName: `Producto ${id}`, kind, tone: "RED", priority: 1,
    title: "Texto largo sin stock", detail: "Cobertura y datos", suggestedAction: "Sugerencia extensa" };
}

describe("groupStockAlerts", () => {
  it("groups by alert kind without losing products or priority order", () => {
    const groups = groupStockAlerts([alert("a"), alert("b", "LOW_COVERAGE"), alert("c")], []);
    expect(groups.map(group => group.kind)).toEqual(["STOCKOUT", "LOW_COVERAGE"]);
    expect(groups[0].products.map(product => product.id)).toEqual(["a", "c"]);
    expect(groups[1].products[0].name).toBe("Producto b");
    expect(groups[0].action).toBe("Reponer");
    expect(JSON.stringify(groups)).not.toContain("Sugerencia extensa");
    expect(JSON.stringify(groups)).not.toContain("Texto largo sin stock");
  });

  it("keeps identifying attributes and SKU while avoiding repeated details", () => {
    const rows = buildStockRows([{ id: "a", name: "Aceite", sku: "123", unit: "un",
      brand: " Marca ", model: "Marca", attributes: "POE | 1 L | R410",
      category: null, supplier: null, demand_profile: null, demand_monthly_estimate: null }], [], Date.now());
    const [group] = groupStockAlerts([alert("a")], rows);
    expect(group.products).toEqual([{ id: "a", name: "Aceite", sku: "123", detail: "Marca · POE | 1 L | R410" }]);
  });
});
