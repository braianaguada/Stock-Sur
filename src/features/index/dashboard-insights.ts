import type { MovementType } from "@/features/stock/types";
import { buildItemDisplayName } from "@/lib/item-display";
import { monthKeyFromTimestamp } from "@/lib/formatters";

type DashboardItem = {
  id: string;
  name: string;
  sku: string | null;
  attributes: string | null;
  category: string | null;
  is_active: boolean;
};

type DashboardMovement = {
  item_id: string;
  type: MovementType;
  quantity: number;
  created_at: string;
};

type DashboardPricingBase = {
  item_id: string;
  base_cost: number;
};

type BuildDashboardInsightsInput = {
  items: DashboardItem[];
  movements: DashboardMovement[];
  pricingBase: DashboardPricingBase[];
  suppliersCount: number;
  quotesCount: number;
  now?: Date;
};

export type DashboardMetric = {
  label: string;
  value: number;
  hint: string;
};

export type DashboardDonutSlice = {
  name: string;
  value: number;
  fill: string;
};

export type DashboardSeriesPoint = {
  label: string;
  in: number;
  out: number;
};

export type DashboardCategoryPoint = {
  category: string;
  value: number;
};

export type DashboardTopItem = {
  itemId: string;
  name: string;
  sku: string | null;
  quantity: number;
  baseCost: number;
  stockValue: number;
};

export type DashboardInsights = {
  metrics: {
    inventoryValue: number;
    inventoryUnits: number;
    itemsWithStock: number;
    itemsWithoutCost: number;
    activeItems: number;
    suppliersCount: number;
    quotesCount: number;
    valuedItemsShare: number;
  };
  stockComposition: DashboardDonutSlice[];
  monthlyMovements: DashboardSeriesPoint[];
  categoryValues: DashboardCategoryPoint[];
  topItemsByValue: DashboardTopItem[];
  totalPotentialValue: number;
  missingValueEstimate: number;
  hasStockData: boolean;
  hasMovementData: boolean;
  hasCategoryData: boolean;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function buildMonthBuckets(now: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("es-AR", { month: "short" })
      .format(date)
      .replace(".", "");

    return {
      key,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      in: 0,
      out: 0,
    };
  });
}

export function buildDashboardInsights({
  items,
  movements,
  pricingBase,
  suppliersCount,
  quotesCount,
  now = new Date(),
}: BuildDashboardInsightsInput): DashboardInsights {
  const activeItems = items.filter((item) => item.is_active);
  const activeItemsById = new Map(activeItems.map((item) => [item.id, item]));
  const stockByItemId = new Map<string, number>();
  const pricingByItemId = new Map(pricingBase.map((row) => [row.item_id, Number(row.base_cost) || 0]));
  const movementBuckets = buildMonthBuckets(now);
  const movementBucketIndex = new Map(movementBuckets.map((bucket, index) => [bucket.key, index]));

  for (const item of activeItems) {
    stockByItemId.set(item.id, 0);
  }

  for (const movement of movements) {
    if (!activeItemsById.has(movement.item_id)) continue;

    const quantity = Number(movement.quantity) || 0;
    const current = stockByItemId.get(movement.item_id) ?? 0;
    if (movement.type === "IN") stockByItemId.set(movement.item_id, current + quantity);
    else if (movement.type === "OUT") stockByItemId.set(movement.item_id, current - quantity);
    else stockByItemId.set(movement.item_id, current + quantity);

    const key = monthKeyFromTimestamp(movement.created_at);
    const bucketIndex = movementBucketIndex.get(key);
    if (bucketIndex === undefined) continue;

    if (movement.type === "IN") movementBuckets[bucketIndex].in += Math.max(0, quantity);
    if (movement.type === "OUT") movementBuckets[bucketIndex].out += Math.max(0, quantity);
  }

  const topItemsByValue: DashboardTopItem[] = [];
  const categoryValueMap = new Map<string, number>();
  let inventoryValue = 0;
  let totalPotentialValue = 0;
  let missingValueEstimate = 0;
  let inventoryUnits = 0;
  let itemsWithStock = 0;
  let itemsWithoutCost = 0;
  let valuedItemsCount = 0;
  let zeroStockItems = 0;

  for (const item of activeItems) {
    const quantity = Number(stockByItemId.get(item.id) ?? 0);
    const positiveQuantity = Math.max(0, quantity);
    const baseCost = Math.max(0, Number(pricingByItemId.get(item.id) ?? 0));

    if (positiveQuantity <= 0) {
      zeroStockItems += 1;
      continue;
    }

    itemsWithStock += 1;
    inventoryUnits += positiveQuantity;
    totalPotentialValue += positiveQuantity * baseCost;

    if (baseCost <= 0) {
      itemsWithoutCost += 1;
      continue;
    }

    const stockValue = positiveQuantity * baseCost;
    valuedItemsCount += 1;
    inventoryValue += stockValue;

    const categoryName = item.category?.trim() || "Sin categoria";
    categoryValueMap.set(categoryName, (categoryValueMap.get(categoryName) ?? 0) + stockValue);

    topItemsByValue.push({
      itemId: item.id,
      name: buildItemDisplayName({ name: item.name, attributes: item.attributes }),
      sku: item.sku,
      quantity: positiveQuantity,
      baseCost,
      stockValue,
    });
  }

  missingValueEstimate = Math.max(0, totalPotentialValue - inventoryValue);

  const stockComposition: DashboardDonutSlice[] = [
    {
      name: "Con stock y costo",
      value: valuedItemsCount,
      fill: "hsl(var(--primary))",
    },
    {
      name: "Con stock sin costo",
      value: itemsWithoutCost,
      fill: "hsl(var(--warning))",
    },
    {
      name: "Sin stock",
      value: zeroStockItems,
      fill: "hsl(var(--muted-foreground) / 0.55)",
    },
  ].filter((slice) => slice.value > 0);

  const categoryValues = Array.from(categoryValueMap.entries())
    .map(([category, value]) => ({ category, value: roundCurrency(value) }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);

  const hasMovementData = movementBuckets.some((bucket) => bucket.in > 0 || bucket.out > 0);

  return {
    metrics: {
      inventoryValue: roundCurrency(inventoryValue),
      inventoryUnits: roundCurrency(inventoryUnits),
      itemsWithStock,
      itemsWithoutCost,
      activeItems: activeItems.length,
      suppliersCount,
      quotesCount,
      valuedItemsShare: itemsWithStock > 0 ? Math.round((valuedItemsCount / itemsWithStock) * 100) : 0,
    },
    stockComposition,
    monthlyMovements: movementBuckets.map((bucket) => ({
      label: bucket.label,
      in: roundCurrency(bucket.in),
      out: roundCurrency(bucket.out),
    })),
    categoryValues,
    topItemsByValue: topItemsByValue
      .sort((left, right) => right.stockValue - left.stockValue)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        stockValue: roundCurrency(item.stockValue),
        quantity: roundCurrency(item.quantity),
      })),
    totalPotentialValue: roundCurrency(totalPotentialValue),
    missingValueEstimate: roundCurrency(missingValueEstimate),
    hasStockData: itemsWithStock > 0,
    hasMovementData,
    hasCategoryData: categoryValues.length > 0,
  };
}
