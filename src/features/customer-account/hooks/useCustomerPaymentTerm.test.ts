import { describe, expect, it } from "vitest";
import { validatePaymentTerm } from "./useCustomerPaymentTerm";

describe("customer payment term", () => {
  it("accepts cash and whole day terms", () => {
    expect(validatePaymentTerm("0")).toBe(0);
    expect(validatePaymentTerm(" 45 ")).toBe(45);
  });
  it.each(["", " ", "-1", "2.5", "3651", "NaN", "Infinity"])("rejects invalid term %s", (value) => {
    expect(() => validatePaymentTerm(value)).toThrow();
  });
});
