import { describe, expect, it } from "vitest";
import { resolvePriceListsNavigation } from "./navigation";

describe("resolvePriceListsNavigation", () => {
  it("gives onboarding URL state precedence over persisted UI state", () => {
    expect(
      resolvePriceListsNavigation({
        itemId: "item-1",
        tab: "base",
        persisted: { moduleTab: "lists", baseSearch: "old search", listSearch: "retail" },
      }),
    ).toEqual({ moduleTab: "base", baseSearch: "", listSearch: "retail" });
  });

  it("restores persisted state when the URL has no navigation intent", () => {
    expect(
      resolvePriceListsNavigation({
        itemId: null,
        tab: null,
        persisted: { moduleTab: "lists", baseSearch: "sku", listSearch: "retail" },
      }),
    ).toEqual({ moduleTab: "lists", baseSearch: "sku", listSearch: "retail" });
  });
});
