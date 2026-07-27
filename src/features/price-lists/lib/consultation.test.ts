import { describe, expect, it } from "vitest";
import { resolveConsultListIdForQuery } from "./consultation";

describe("price consultation helpers", () => {
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
});
