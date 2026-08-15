import { describe, expect, it } from "vitest";
import type { StockRow } from "@/features/stock/types";
import type { CatalogLine } from "@/features/suppliers/types";
import { buildSupplierReorderSuggestions } from "./reorderSuggestions";

const stock = (patch: Partial<StockRow>): StockRow => ({
  item_id: "item-1", item_name: "Filtro aceite", item_sku: "FA-10", item_unit: "UN",
  item_supplier: null, item_brand: null, item_model: null, item_attributes: null,
  item_category: null, total: 2, avg_daily_out_30d: 0.5, avg_daily_out_90d: 0.3,
  avg_daily_out_365d: 0.1, demand_daily: 0, days_of_cover: null,
  months_of_cover_low_rotation: null, health: "RED", low_rotation: false,
  demand_profile: "MEDIUM", demand_monthly_estimate: null, ...patch,
});
const line = (patch: Partial<CatalogLine> = {}): CatalogLine => ({
  id: "line-1", supplier_code: "FA-10", raw_description: "Filtro aceite", cost: 10,
  currency: "ARS", tax_treatment: "UNKNOWN", ...patch,
});

describe("buildSupplierReorderSuggestions", () => {
  it("sugiere cobertura de 30 dias usando solo promedios de salidas reales", () => {
    const [result] = buildSupplierReorderSuggestions([line()], [stock({})]);
    expect(result.matchReason).toBe("SKU");
    expect(result.suggestedQuantity).toBe(11);
    expect(result.daysOfCover).toBeCloseTo(2 / 0.43);
  });

  it("prioriza el vinculo confirmado y no recomienda productos sin rotacion", () => {
    expect(buildSupplierReorderSuggestions(
      [line({ supplier_code: "OTRO", matched_item_id: "item-1" })],
      [stock({ avg_daily_out_30d: 0, avg_daily_out_90d: 0, avg_daily_out_365d: 0 })],
    )).toEqual([]);
  });

  it("no usa coincidencias ambiguas de SKU", () => {
    const duplicate = stock({ item_id: "item-2", item_name: "Otro", item_sku: "FA-10" });
    expect(buildSupplierReorderSuggestions(
      [line({ raw_description: "Sin coincidencia" })],
      [stock({}), duplicate],
    )).toEqual([]);
  });
});
