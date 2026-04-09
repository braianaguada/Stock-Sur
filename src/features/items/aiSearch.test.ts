import { describe, expect, it } from "vitest";
import { buildItemAiSearchCandidates } from "@/features/items/aiSearch";
import type { Item } from "@/features/items/types";

const ITEMS: Item[] = [
  {
    id: "1",
    sku: "SS-000020",
    name: "ACEITE P/BOMBA DE VACIO X 1LT DOSIVAC-",
    supplier: null,
    brand: null,
    model: null,
    unit: "kg",
    category: "GAS/ACEITE",
    demand_profile: "LOW",
    demand_monthly_estimate: null,
    is_active: true,
  },
  {
    id: "2",
    sku: "SS-000042",
    name: "ACEITE SUNISO 3GS X 1 LITRO-",
    supplier: null,
    brand: null,
    model: null,
    unit: "un",
    category: "GAS/ACEITE",
    demand_profile: "LOW",
    demand_monthly_estimate: null,
    is_active: true,
  },
];

describe("item ai candidate generation", () => {
  it("keeps typo-tolerant candidates like doci for dosivac", () => {
    const candidates = buildItemAiSearchCandidates({
      items: ITEMS,
      aliases: [],
      query: "doci",
    });

    expect(candidates.map((item) => item.itemId)).toContain("1");
  });

  it("does not include unrelated items for missing gibberish", () => {
    const candidates = buildItemAiSearchCandidates({
      items: ITEMS,
      aliases: [],
      query: "lalal",
    });

    expect(candidates).toHaveLength(0);
  });
});
