import { roundPrice, type PriceRoundingConfig } from "@/features/pricing/rounding";

export function getOperationalPrice(
  value: number | null | undefined,
  config: PriceRoundingConfig | null | undefined,
) {
  const operationalPrice = roundPrice(value, config);

  return {
    originalPrice: value,
    operationalPrice,
    wasRounded:
      typeof value === "number"
      && typeof operationalPrice === "number"
      && Number.isFinite(value)
      && Number.isFinite(operationalPrice)
      && operationalPrice !== value,
  };
}
