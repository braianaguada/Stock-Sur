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

export function resolveConsultListIdForQuery({
  currentListId,
  quickListId,
  itemIdFromQuery,
  priceLists,
  snapshotsByListAndItemId,
}: {
  currentListId: string | null;
  quickListId?: string | null;
  itemIdFromQuery: string | null;
  priceLists: Array<{ id: string }>;
  snapshotsByListAndItemId: Map<string, Map<string, unknown>>;
}) {
  if (priceLists.length === 0) return null;

  if (itemIdFromQuery) {
    const currentListHasItem = currentListId ? (snapshotsByListAndItemId.get(currentListId)?.has(itemIdFromQuery) ?? false) : false;
    if (currentListHasItem) return currentListId;

    const matchingList = priceLists.find((list) => snapshotsByListAndItemId.get(list.id)?.has(itemIdFromQuery) ?? false);
    if (matchingList) return matchingList.id;
  }

  if (currentListId && priceLists.some((list) => list.id === currentListId)) return currentListId;
  if (quickListId && priceLists.some((list) => list.id === quickListId)) return quickListId;
  return priceLists[0].id;
}

export function getQuickPriceListStorageKey(userId: string | null | undefined, companyId: string | null | undefined) {
  return `price-lists:quick-list:${userId ?? "anonymous"}:${companyId ?? "no-company"}`;
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    rows: rows.slice(start, start + safePageSize),
    page: safePage,
    totalItems,
    totalPages,
    rangeStart: totalItems === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + safePageSize, totalItems),
  };
}
