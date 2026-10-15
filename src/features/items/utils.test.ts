import { describe, expect, it } from "vitest";
import { validateItemCode } from "./utils";
describe("numeric product codes", () => {
  it("leaves automatic assignment to the database", () => expect(validateItemCode("  ")).toBe(""));
  it("preserves numeric codes as strings without precision loss", () => expect(validateItemCode(" 124403459030000000001 ")).toBe("124403459030000000001"));
  it("rejects legacy and decimal input for new manual codes", () => {
    for (const value of ["ITM-123", "12.3", "-4", "1e10"]) expect(() => validateItemCode(value)).toThrow("solo numeros");
  });
});
