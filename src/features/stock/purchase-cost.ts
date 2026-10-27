import type { StockMovementForm } from "./types";

export function purchaseCostFields(form: StockMovementForm) {
  const incoming = form.type === "IN" || (form.type === "ADJUSTMENT" && form.adjustment_direction === "ADD");
  if (!incoming) return { unit_cost_ars: null, purchase_supplier: null };
  const raw = form.unit_cost_ars?.trim() ?? "";
  const cost = raw === "" ? null : Number(raw);
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    throw new Error("El costo unitario debe ser un número mayor o igual a cero");
  }
  return { unit_cost_ars: cost, purchase_supplier: form.purchase_supplier?.trim() || null };
}
