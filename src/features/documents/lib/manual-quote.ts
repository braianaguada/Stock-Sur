import type { LineDraft } from "../types";
import { calculatePriceFromCostBase } from "../utils";

export function createManualQuoteLine(): LineDraft {
  return {
    item_id: null, sku_snapshot: "", description: "", unit: "UN", quantity: 1,
    unit_price: 0, pricing_mode: "MANUAL_MARGIN", suggested_unit_price: 0,
    base_cost_snapshot: 0, list_flete_pct_snapshot: 0, list_utilidad_pct_snapshot: 0,
    list_impuesto_pct_snapshot: 21, manual_margin_pct: 0,
    price_overridden_by: null, price_overridden_at: null,
  };
}

export function recalculateManualQuote(line: LineDraft): LineDraft {
  const margin = line.manual_margin_pct ?? line.list_utilidad_pct_snapshot ?? 0;
  const price = calculatePriceFromCostBase(line.base_cost_snapshot ?? 0, line.list_flete_pct_snapshot, margin, 21);
  return { ...line, pricing_mode: "MANUAL_MARGIN", manual_margin_pct: margin,
    list_utilidad_pct_snapshot: margin, list_impuesto_pct_snapshot: 21,
    suggested_unit_price: price, unit_price: price };
}

export function normalizeManualQuote(line: LineDraft): LineDraft {
  if (!line.description.trim()) throw new Error("Completa la descripcion de cada producto manual");
  const values = [line.quantity, line.unit_price, line.base_cost_snapshot ?? 0,
    line.list_flete_pct_snapshot ?? 0, line.manual_margin_pct ?? line.list_utilidad_pct_snapshot ?? 0];
  if (values.some((value) => !Number.isFinite(value) || value < 0) || line.quantity <= 0) {
    throw new Error("Revisa las cantidades, costos y porcentajes de los productos manuales: deben ser numeros validos y no negativos");
  }
  const normalized = { ...line, description: line.description.trim(), unit: line.unit.trim() || "UN", list_impuesto_pct_snapshot: 21 };
  const result = line.pricing_mode === "MANUAL_MARGIN" ? recalculateManualQuote(normalized) : normalized;
  if (!Number.isFinite(result.unit_price * result.quantity)) throw new Error("El importe del producto manual es demasiado grande");
  return result;
}
