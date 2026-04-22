import { describe, expect, it } from "vitest";
import { buildItemDisplayMeta, buildItemDisplayName } from "@/lib/item-display";

describe("item display helpers", () => {
  it("includes brand, model and attributes in the name", () => {
    expect(
      buildItemDisplayName({
        name: "Válvula",
        brand: "Ramos",
        model: "X200",
        attributes: "1/2 inox",
      }),
    ).toBe("Válvula - Ramos | X200 | 1/2 inox");
  });

  it("includes sku plus details in metadata", () => {
    expect(
      buildItemDisplayMeta({
        name: "Válvula",
        sku: "VAL-01",
        brand: "Ramos",
        model: "X200",
        attributes: "1/2 inox",
      }),
    ).toBe("VAL-01 | Ramos | X200 | 1/2 inox");
  });
});
