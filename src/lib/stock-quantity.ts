const INTEGER_ONLY_UNITS = new Set(["un"]);

export function formatStockQuantity(value: number, unit: string | null) {
  if (!Number.isFinite(value)) return "-";
  if (unit && INTEGER_ONLY_UNITS.has(unit)) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  const rounded = Number(value.toFixed(3));
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 3,
  }).format(rounded);
}
