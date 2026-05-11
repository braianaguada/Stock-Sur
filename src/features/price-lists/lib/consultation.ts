export type PriceConsultationState = {
  label: string;
  className: string;
};

export function getPriceConsultationState(row: {
  base_cost: number | null;
  has_price: boolean;
  needs_recalculation: boolean;
}): PriceConsultationState {
  if (!row.base_cost) {
    return {
      label: "Sin costo base",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    };
  }

  if (!row.has_price) {
    return {
      label: "Sin precio en lista",
      className: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    };
  }

  if (row.needs_recalculation) {
    return {
      label: "Recalcular",
      className: "border-orange-500/30 bg-orange-500/10 text-orange-700",
    };
  }

  return {
    label: "Precio vigente",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  };
}

export function getApproxMarginPct(baseCost: number | null, operationalPrice: number | null) {
  if (typeof operationalPrice !== "number" || operationalPrice <= 0) return null;
  return ((operationalPrice - (Number(baseCost) || 0)) / operationalPrice) * 100;
}
