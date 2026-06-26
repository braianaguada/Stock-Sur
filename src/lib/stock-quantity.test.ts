import { describe, expect, it } from "vitest";
import { formatStockQuantity } from "@/lib/stock-quantity";

describe("formatStockQuantity", () => {
  it("hides floating point noise in stock quantities", () => {
    expect(formatStockQuantity(73.30000000000001, null)).toBe("73,3");
    expect(formatStockQuantity(10.325000000000001, null)).toBe("10,325");
  });

  it("keeps integer-only units rounded without decimals", () => {
    expect(formatStockQuantity(9.8, "un")).toBe("10");
  });

  it("returns a placeholder for invalid values", () => {
    expect(formatStockQuantity(Number.NaN, null)).toBe("-");
  });
});
