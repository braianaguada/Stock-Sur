import { describe, expect, it } from "vitest";
import { getApproxMarginPct, getPriceConsultationState, resolveConsultListIdForQuery } from "./consultation";

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
});
