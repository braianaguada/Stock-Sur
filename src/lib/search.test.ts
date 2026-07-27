import { describe, expect, it } from "vitest";
import { normalizeSearchText, searchIncludes } from "./search";

describe("search normalization", () => {
  it("normalizes accents, spacing and supported search punctuation", () => {
    expect(normalizeSearchText("  CAÑO   1/2 + ÁCERO.  ")).toBe("cano 1/2 + acero.");
  });

  it("accepts nullable values without leaking their string representation", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
  });

  it("matches equivalent accented and unaccented text", () => {
    expect(searchIncludes("Válvula para caño", "valvula para cano")).toBe(true);
  });
});
