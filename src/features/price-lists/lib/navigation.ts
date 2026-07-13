export type PersistedPriceListsNavigation = {
  baseSearch?: string;
  listSearch?: string;
  moduleTab?: string;
};

export function resolvePriceListsNavigation({
  itemId,
  tab,
  persisted,
}: {
  itemId: string | null;
  tab: string | null;
  persisted: PersistedPriceListsNavigation;
}) {
  const routeTab = tab === "lists" ? "lists" : tab === "base" || itemId ? "base" : null;

  return {
    moduleTab: routeTab ?? (persisted.moduleTab === "lists" ? "lists" : "base"),
    baseSearch: itemId ? "" : (persisted.baseSearch ?? ""),
    listSearch: persisted.listSearch ?? "",
  };
}
