import { roundPrice, type PriceRoundingConfig } from "@/features/pricing/rounding";

export type OperationalPriceSource =
  | "MANUAL_DOCUMENT"
  | "PRODUCT_OVERRIDE"
  | "LIST_FORMULA"
  | "FALLBACK";

type OperationalPriceInput = {
  calculatedPrice?: number | null;
  manualOverridePrice?: number | null;
  manualPriceEnabled?: boolean | null;
  documentPrice?: number | null;
  isManualDocumentPrice?: boolean | null;
  fallbackPrice?: number | null;
  config?: PriceRoundingConfig | null;
  roundFormula?: (price: number) => number;
};

type OperationalPriceResult = {
  price: number;
  source: OperationalPriceSource;
  originalCalculatedPrice?: number;
  manualOverridePrice?: number;
  roundedFrom?: number;
  isRounded: boolean;
  isProductOverride: boolean;
  originalPrice: number | null | undefined;
  operationalPrice: number | null | undefined;
  wasRounded: boolean;
};

function isValidPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function result({
  price,
  source,
  originalCalculatedPrice,
  manualOverridePrice,
  roundedFrom,
}: {
  price: number;
  source: OperationalPriceSource;
  originalCalculatedPrice?: number;
  manualOverridePrice?: number;
  roundedFrom?: number;
}): OperationalPriceResult {
  const isRounded = typeof roundedFrom === "number" && roundedFrom !== price;
  return {
    price,
    source,
    originalCalculatedPrice,
    manualOverridePrice,
    roundedFrom,
    isRounded,
    isProductOverride: source === "PRODUCT_OVERRIDE",
    originalPrice: roundedFrom ?? originalCalculatedPrice ?? manualOverridePrice ?? price,
    operationalPrice: price,
    wasRounded: isRounded,
  };
}

export function getOperationalPrice(input: OperationalPriceInput): OperationalPriceResult;
export function getOperationalPrice(
  value: number | null | undefined,
  config: PriceRoundingConfig | null | undefined,
): OperationalPriceResult;
export function getOperationalPrice(
  inputOrValue: OperationalPriceInput | number | null | undefined,
  config?: PriceRoundingConfig | null | undefined,
) {
  if (typeof inputOrValue === "object" && inputOrValue !== null) {
    const input = inputOrValue;
    const calculatedPrice = isValidPrice(input.calculatedPrice) ? input.calculatedPrice : undefined;
    const overridePrice = isValidPrice(input.manualOverridePrice) ? input.manualOverridePrice : undefined;

    if (input.isManualDocumentPrice && isValidPrice(input.documentPrice)) {
      return result({
        price: input.documentPrice,
        source: "MANUAL_DOCUMENT",
        originalCalculatedPrice: calculatedPrice,
        manualOverridePrice: overridePrice,
      });
    }

    if (input.manualPriceEnabled && overridePrice !== undefined) {
      return result({
        price: overridePrice,
        source: "PRODUCT_OVERRIDE",
        originalCalculatedPrice: calculatedPrice,
        manualOverridePrice: overridePrice,
      });
    }

    if (calculatedPrice !== undefined) {
      const rounded = input.roundFormula
        ? input.roundFormula(calculatedPrice)
        : roundPrice(calculatedPrice, input.config);
      return result({
        price: rounded,
        source: "LIST_FORMULA",
        originalCalculatedPrice: calculatedPrice,
        roundedFrom: rounded !== calculatedPrice ? calculatedPrice : undefined,
      });
    }

    const fallbackPrice = isValidPrice(input.fallbackPrice) ? input.fallbackPrice : 0;
    return result({ price: fallbackPrice, source: "FALLBACK" });
  }

  const value = inputOrValue;
  const operationalPrice = roundPrice(value, config);
  const price = isValidPrice(operationalPrice) ? operationalPrice : 0;

  const roundedFrom = isValidPrice(value) && operationalPrice !== value ? value : undefined;
  const isRounded = typeof roundedFrom === "number" && roundedFrom !== price;

  return {
    price,
    source: isValidPrice(value) ? "LIST_FORMULA" : "FALLBACK",
    originalCalculatedPrice: isValidPrice(value) ? value : undefined,
    roundedFrom,
    isRounded,
    isProductOverride: false,
    originalPrice: value,
    operationalPrice,
    wasRounded: isRounded,
  };
}
