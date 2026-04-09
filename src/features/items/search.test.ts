import { describe, expect, it } from "vitest";
import { rankNaturalItemSearch } from "@/features/items/search";
import type { Item } from "@/features/items/types";

const ITEMS: Item[] = [
  {
    id: "1",
    sku: "CA-12",
    name: "Caño cobre 1/2 0.8 mm x kg",
    brand: null,
    model: null,
    unit: "kg",
    category: "Canos",
    demand_profile: "MEDIUM",
    demand_monthly_estimate: null,
    is_active: true,
  },
  {
    id: "2",
    sku: "AA-3000",
    name: "Aire acondicionado split inverter 3000 fg",
    brand: "York",
    model: "Ultra",
    unit: "un",
    category: "Climatizacion",
    demand_profile: "LOW",
    demand_monthly_estimate: null,
    is_active: true,
  },
];

describe("natural item search", () => {
  it("finds products by natural fraction wording", () => {
    const ranked = rankNaturalItemSearch({
      items: ITEMS,
      aliases: [],
      query: "cano cobre media",
    });

    expect(ranked[0]?.id).toBe("1");
  });

  it("finds products by colloquial acronyms", () => {
    const ranked = rankNaturalItemSearch({
      items: ITEMS,
      aliases: [],
      query: "aa york 3000",
    });

    expect(ranked[0]?.id).toBe("2");
  });

  it("considers aliases in ranking", () => {
    const ranked = rankNaturalItemSearch({
      items: ITEMS,
      aliases: [{ item_id: "2", alias: "split york ultra", is_supplier_code: false }],
      query: "split ultra",
    });

    expect(ranked[0]?.id).toBe("2");
  });

  it("avoids weak matches for multiword queries", () => {
    const ranked = rankNaturalItemSearch({
      items: ITEMS,
      aliases: [],
      query: "york media vacio",
    });

    expect(ranked).toHaveLength(0);
  });
});
