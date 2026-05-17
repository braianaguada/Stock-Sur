import { describe, expect, it } from "vitest";
import { getOperationalPrice } from "./operational-price";

describe("getOperationalPrice", () => {
  it("uses formula price when no override exists", () => {
    const price = getOperationalPrice({ calculatedPrice: 1850, config: { enabled: false } });

    expect(price.price).toBe(1850);
    expect(price.source).toBe("LIST_FORMULA");
  });

  it("uses active product override without rounding and keeps formula reference", () => {
    const price = getOperationalPrice({
      calculatedPrice: 1850,
      manualOverridePrice: 2100,
      manualPriceEnabled: true,
      config: { enabled: true, increment: 500 },
    });

    expect(price.price).toBe(2100);
    expect(price.source).toBe("PRODUCT_OVERRIDE");
    expect(price.originalCalculatedPrice).toBe(1850);
    expect(price.isRounded).toBe(false);
  });

  it("rounds formula prices when configured", () => {
    const price = getOperationalPrice({ calculatedPrice: 1850, config: { enabled: true, increment: 500 } });

    expect(price.price).toBe(2000);
    expect(price.roundedFrom).toBe(1850);
  });

  it("returns to formula when override is inactive", () => {
    const price = getOperationalPrice({
      calculatedPrice: 1850,
      manualOverridePrice: 2100,
      manualPriceEnabled: false,
      config: { enabled: false },
    });

    expect(price.price).toBe(1850);
    expect(price.source).toBe("LIST_FORMULA");
  });

  it("keeps manual document price above product override", () => {
    const price = getOperationalPrice({
      calculatedPrice: 1850,
      manualOverridePrice: 2100,
      manualPriceEnabled: true,
      documentPrice: 1999,
      isManualDocumentPrice: true,
      config: { enabled: true, increment: 500 },
    });

    expect(price.price).toBe(1999);
    expect(price.source).toBe("MANUAL_DOCUMENT");
  });
});
