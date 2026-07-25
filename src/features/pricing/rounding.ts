export type PriceRoundingConfig = {
  enabled?: boolean | null;
  increment?: number | null;
  mode?: "nearest";
};

const VALID_INCREMENTS = new Set<number>([100, 500, 1000]);

export function roundPrice<T extends number | null | undefined>(
  value: T,
  config: PriceRoundingConfig | null | undefined,
): T {
  if (value === null || value === undefined) return value;
  if (!config?.enabled) return value;
  if (!Number.isFinite(value) || value < 0) return value;
  if (value === 0) return value;

  const increment = Number(config.increment);
  if (!VALID_INCREMENTS.has(increment)) return value;

  return (Math.round(value / increment) * increment) as T;
}
