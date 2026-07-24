import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  optimisticallyUpdateDemandProfile,
  rollbackItemsCatalog,
} from "@/features/items/catalog-cache";
import type { Item } from "@/features/items/types";
import { queryKeys } from "@/lib/query-keys";

function buildItem(id: string, demandProfile: Item["demand_profile"]): Item {
  return {
    id,
    sku: `SKU-${id}`,
    name: `Item ${id}`,
    supplier: null,
    brand: null,
    model: null,
    attributes: null,
    unit: "un",
    category: "General",
    demand_profile: demandProfile,
    demand_monthly_estimate: null,
    is_active: true,
  };
}

describe("items catalog optimistic cache", () => {
  it("updates and rolls back only the catalog for the active company and filters", async () => {
    const queryClient = new QueryClient();
    const activeCatalogKey = queryKeys.items.catalog("company-1", "all", "active");
    const otherCompanyKey = queryKeys.items.catalog("company-2", "all", "active");
    const otherFilterKey = queryKeys.items.catalog("company-1", "all", "inactive");
    const initialItems = [buildItem("item-1", "LOW"), buildItem("item-2", "MEDIUM")];
    const untouchedItems = [buildItem("item-3", "LOW")];

    queryClient.setQueryData(activeCatalogKey, initialItems);
    queryClient.setQueryData(otherCompanyKey, untouchedItems);
    queryClient.setQueryData(otherFilterKey, untouchedItems);

    const snapshot = await optimisticallyUpdateDemandProfile(
      queryClient,
      activeCatalogKey,
      ["item-1"],
      "HIGH",
    );

    expect(queryClient.getQueryData<Item[]>(activeCatalogKey)).toEqual([
      { ...initialItems[0], demand_profile: "HIGH" },
      initialItems[1],
    ]);
    expect(queryClient.getQueryData(otherCompanyKey)).toEqual(untouchedItems);
    expect(queryClient.getQueryData(otherFilterKey)).toEqual(untouchedItems);
    expect(queryClient.getQueryData(queryKeys.items.all())).toBeUndefined();

    rollbackItemsCatalog(queryClient, snapshot);

    expect(queryClient.getQueryData(activeCatalogKey)).toEqual(initialItems);
    expect(queryClient.getQueryData(otherCompanyKey)).toEqual(untouchedItems);
  });
});
