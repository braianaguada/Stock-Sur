import { describe, expect, it } from "vitest";
import { filterComboProductOptions, hasComboProductLine } from "./comboProductSearch";

const items = [
  { id: "item-1", sku: "AA-1", name: "Caño cobre", brand: "Sur", category: "Instalacion", unit: "m", is_active: true },
  { id: "item-2", sku: "BB-2", name: "Soporte", brand: "Norte", category: "Herreria", unit: "un", is_active: true },
  { id: "item-3", sku: "CC-3", name: "Inactivo", brand: "Sur", category: "Instalacion", unit: "un", is_active: false },
];

describe("combo product search", () => {
  it("filters active products by sku, name, brand or category", () => {
    expect(filterComboProductOptions(items, "cobre").map((item) => item.id)).toEqual(["item-1"]);
    expect(filterComboProductOptions(items, "BB").map((item) => item.id)).toEqual(["item-2"]);
    expect(filterComboProductOptions(items, "sur").map((item) => item.id)).toEqual(["item-1"]);
    expect(filterComboProductOptions(items, "instalacion").map((item) => item.id)).toEqual(["item-1"]);
  });

  it("does not expose inactive products or empty searches", () => {
    expect(filterComboProductOptions(items, "")).toEqual([]);
    expect(filterComboProductOptions(items, "inactivo")).toEqual([]);
  });

  it("detects duplicate combo lines before adding a product", () => {
    expect(hasComboProductLine([{ item_id: "item-1", quantity: 1, line_order: 1, notes: "" }], "item-1")).toBe(true);
    expect(hasComboProductLine([{ item_id: "item-1", quantity: 1, line_order: 1, notes: "" }], "item-2")).toBe(false);
  });
});
