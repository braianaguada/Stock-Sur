import type { PriceListProductRow } from "@/features/price-lists/types";

const normalizePercent = (value: number | null | undefined) =>
  Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

export const markupToGrossMargin = (markupPct: number | null | undefined) => {
  const markup = normalizePercent(markupPct);
  return markup === 0 ? 0 : (markup / (100 + markup)) * 100;
};

export const calculateGrossMargin = ({
  baseCost,
  grossPrice,
  freightPct,
  taxPct,
}: {
  baseCost: number;
  grossPrice: number;
  freightPct: number | null | undefined;
  taxPct: number | null | undefined;
}) => {
  if (!Number.isFinite(baseCost) || baseCost <= 0 || !Number.isFinite(grossPrice) || grossPrice <= 0) {
    return null;
  }

  const landedCost = baseCost * (1 + normalizePercent(freightPct) / 100);
  const netPrice = grossPrice / (1 + normalizePercent(taxPct) / 100);
  if (netPrice <= 0) return null;

  return ((netPrice - landedCost) / netPrice) * 100;
};

export const summarizePriceListMargins = ({
  rows,
  freightPct,
  taxPct,
  targetMarginPct,
  resolveOperationalPrice,
}: {
  rows: PriceListProductRow[];
  freightPct: number;
  taxPct: number;
  targetMarginPct: number;
  resolveOperationalPrice: (row: PriceListProductRow) => number;
}) => {
  let evaluableCount = 0;
  let belowTargetCount = 0;
  let missingCostCount = 0;
  let negativeMarginCount = 0;
  let marginTotal = 0;

  for (const row of rows) {
    const margin = calculateGrossMargin({
      baseCost: Number(row.base_cost),
      grossPrice: resolveOperationalPrice(row),
      freightPct,
      taxPct,
    });

    if (margin === null) {
      missingCostCount += 1;
      continue;
    }

    evaluableCount += 1;
    marginTotal += margin;
    if (margin < targetMarginPct - 0.05) belowTargetCount += 1;
    if (margin < 0) negativeMarginCount += 1;
  }

  return {
    evaluableCount,
    belowTargetCount,
    missingCostCount,
    negativeMarginCount,
    averageMarginPct: evaluableCount > 0 ? marginTotal / evaluableCount : null,
  };
};
