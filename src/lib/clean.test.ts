import { describe, expect, it } from "vitest";
import { cleanText, normalizeAlias } from "@/lib/clean";

describe("cleanText", () => {
  it("returns empty string for nullish and reserved string values", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
    expect(cleanText("NaN")).toBe("");
    expect(cleanText(" null ")).toBe("");
    expect(cleanText("undefined")).toBe("");
  });

  it("trims and collapses spaces", () => {
    expect(cleanText("  Codigo   123  ")).toBe("Codigo 123");
  });
});

describe("normalizeAlias", () => {
  it("normalizes aliases for duplicate checks", () => {
    expect(normalizeAlias("  CoD  001 ")).toBe("cod 001");
  });
});
