import { describe, expect, it } from "vitest";
import { getApproxMarginPct, getPriceConsultationState, getQuickPriceListStorageKey, paginateRows, resolveConsultListIdForQuery } from "./consultation";

describe("price consultation helpers", () => {
  it("keeps price state labels visual and explicit", () => {
    expect(getPriceConsultationState({ base_cost: 0, has_price: false, needs_recalculation: false }).label).toBe("Sin costo base");
    expect(getPriceConsultationState({ base_cost: 100, has_price: false, needs_recalculation: false }).label).toBe("Sin precio en lista");
    expect(getPriceConsultationState({ base_cost: 100, has_price: true, needs_recalculation: true }).label).toBe("Recalcular");
    expect(getPriceConsultationState({ base_cost: 100, has_price: true, needs_recalculation: false }).label).toBe("Precio vigente");
  });

  it("calculates approximate margin without changing operational price logic", () => {
    expect(getApproxMarginPct(80, 100)).toBe(20);
    expect(getApproxMarginPct(80, 0)).toBeNull();
    expect(getApproxMarginPct(80, null)).toBeNull();
  });

  it("selects the list containing the queried item before defaulting to the first list", () => {
    const priceLists = [{ id: "list-a" }, { id: "list-b" }];
    const snapshotsByListAndItemId = new Map<string, Map<string, unknown>>([
      ["list-a", new Map([["item-a", {}]])],
      ["list-b", new Map([["item-b", {}]])],
    ]);

    expect(resolveConsultListIdForQuery({ currentListId: null, itemIdFromQuery: "item-b", priceLists, snapshotsByListAndItemId })).toBe("list-b");
  });

  it("keeps the current consultation list when it already contains the queried item", () => {
    const priceLists = [{ id: "list-a" }, { id: "list-b" }];
    const snapshotsByListAndItemId = new Map<string, Map<string, unknown>>([
      ["list-a", new Map([["item-a", {}]])],
      ["list-b", new Map([["item-b", {}]])],
    ]);

    expect(resolveConsultListIdForQuery({ currentListId: "list-b", itemIdFromQuery: "item-b", priceLists, snapshotsByListAndItemId })).toBe("list-b");
  });

  it("falls back to the first list when there is no queried item match", () => {
    expect(resolveConsultListIdForQuery({ currentListId: null, itemIdFromQuery: "missing", priceLists: [{ id: "list-a" }], snapshotsByListAndItemId: new Map() })).toBe("list-a");
  });

  it("uses a quick list preference before defaulting to the first list", () => {
    expect(resolveConsultListIdForQuery({
      currentListId: null,
      quickListId: "list-b",
      itemIdFromQuery: null,
      priceLists: [{ id: "list-a" }, { id: "list-b" }],
      snapshotsByListAndItemId: new Map(),
    })).toBe("list-b");
  });

  it("paginates consultation rows without rendering the full result set", () => {
    const page = paginateRows([1, 2, 3, 4, 5], 2, 2);
    expect(page.rows).toEqual([3, 4]);
    expect(page.totalPages).toBe(3);
    expect(page.rangeStart).toBe(3);
    expect(page.rangeEnd).toBe(4);
  });

  it("builds a quick list localStorage key scoped by user and company", () => {
    expect(getQuickPriceListStorageKey("user-1", "company-1")).toBe("price-lists:quick-list:user-1:company-1");
  });
});
