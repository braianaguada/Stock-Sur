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
