import { describe, expect, it } from "vitest";
import { roundPrice } from "./rounding";

describe("roundPrice", () => {
  it("returns the original price when disabled", () => {
    expect(roundPrice(1256.35, { enabled: false, increment: 500 })).toBe(1256.35);
  });

  it("rounds to 100", () => {
    expect(roundPrice(1256.35, { enabled: true, increment: 100 })).toBe(1300);
  });

  it("rounds to 500", () => {
    expect(roundPrice(1256.35, { enabled: true, increment: 500 })).toBe(1500);
    expect(roundPrice(4987.21, { enabled: true, increment: 500 })).toBe(5000);
  });

  it("rounds to 1000", () => {
    expect(roundPrice(6571.13, { enabled: true, increment: 1000 })).toBe(7000);
  });

  it("keeps zero unchanged", () => {
    expect(roundPrice(0, { enabled: true, increment: 500 })).toBe(0);
  });

  it("returns the original price for invalid increments", () => {
    expect(roundPrice(1256.35, { enabled: true, increment: 250 })).toBe(1256.35);
    expect(roundPrice(1256.35, { enabled: true, increment: null })).toBe(1256.35);
  });

  it("supports null and undefined without breaking", () => {
    expect(roundPrice(null, { enabled: true, increment: 500 })).toBeNull();
    expect(roundPrice(undefined, { enabled: true, increment: 500 })).toBeUndefined();
  });

  it("returns negative values unchanged", () => {
    expect(roundPrice(-1256.35, { enabled: true, increment: 500 })).toBe(-1256.35);
  });
});
