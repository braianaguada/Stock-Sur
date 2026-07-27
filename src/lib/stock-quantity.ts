export function isIntegerOnlyStockUnit(unit: string | null | undefined) {
  return unit === "un";
}

export function formatStockQuantity(value: number, unit: string | null) {
  if (!Number.isFinite(value)) return "-";
  if (isIntegerOnlyStockUnit(unit)) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  const rounded = Number(value.toFixed(3));
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 3,
  }).format(rounded);
}
