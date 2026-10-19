import { describe, expect, it } from "vitest";
import { splitDocumentIncludedVat } from "./included-vat";

describe("included commercial VAT", () => {
  it("splits the manual final price without increasing the amount payable", () => {
    expect(splitDocumentIncludedVat(270000)).toEqual({
      subtotal: 223140.5, tax_total: 46859.5, total: 270000,
    });
  });

  it.each([0, 0.01, 0.03, 121, 1250, 1234.567, -121])("reconciles net plus VAT for %s", (amount) => {
    const result = splitDocumentIncludedVat(amount);
    expect(Math.round((result.subtotal + result.tax_total) * 100)).toBe(Math.round(result.total * 100));
  });
});
