import type { QueryClient } from "@tanstack/react-query";
import type { Item } from "@/features/items/types";
import { queryKeys } from "@/lib/query-keys";

export type ItemsCatalogQueryKey = ReturnType<typeof queryKeys.items.catalog>;

export type ItemsCatalogSnapshot = {
  queryKey: ItemsCatalogQueryKey;
  previousItems: Item[] | undefined;
};

export async function optimisticallyUpdateDemandProfile(
  queryClient: QueryClient,
  queryKey: ItemsCatalogQueryKey,
  selectedItemIds: readonly string[],
  demandProfile: Item["demand_profile"],
): Promise<ItemsCatalogSnapshot> {
  await queryClient.cancelQueries({ queryKey, exact: true });

  const previousItems = queryClient.getQueryData<Item[]>(queryKey);
  const selectedIds = new Set(selectedItemIds);

  queryClient.setQueryData<Item[]>(queryKey, (items) =>
    items?.map((item) =>
      selectedIds.has(item.id)
        ? { ...item, demand_profile: demandProfile }
        : item,
    ),
  );

  return { queryKey, previousItems };
}

export function rollbackItemsCatalog(
  queryClient: QueryClient,
  snapshot: ItemsCatalogSnapshot | undefined,
) {
  if (!snapshot) return;

  queryClient.setQueryData(snapshot.queryKey, snapshot.previousItems);
}
