export const SALE_UNIT_OPTIONS = ["un", "kg", "g", "lt", "ml", "m", "cm"] as const;

export function normalizeSaleUnit(unit: string | null | undefined) {
  const value = (unit ?? '').trim().toLowerCase();
  const aliases: Record<string,string> = {unidad:'un',unidades:'un',u:'un',und:'un',uds:'un',kilo:'kg',kilos:'kg',kilogramo:'kg',kilogramos:'kg',gramo:'g',gramos:'g',l:'lt',litro:'lt',litros:'lt',metro:'m',metros:'m',mts:'m',mt:'m',centimetro:'cm',centimetros:'cm',mililitro:'ml',mililitros:'ml'};
  return aliases[value] ?? value;
}

export function validateSaleQuantity(quantity: number, unit: string | null | undefined) {
  if (!Number.isFinite(quantity)) throw new Error('La cantidad debe ser un numero valido');
  if (normalizeSaleUnit(unit) === 'un' && !Number.isInteger(quantity)) {
    throw new Error('Este producto se vende por unidad entera. Ingresa una cantidad sin decimales.');
  }
}

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
