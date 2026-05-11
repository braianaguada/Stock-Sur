import { describe, expect, it } from "vitest";
import { customerAccountPath, customerIdFromAccountParams } from "./routes";

describe("customer account routes", () => {
  it("generates a customer-filtered account statement link", () => {
    expect(customerAccountPath("customer-1")).toBe("/customer-account?customerId=customer-1");
  });

  it("omits the query param without customer", () => {
    expect(customerAccountPath(null)).toBe("/customer-account");
  });

  it("reads the current customer filter from supported query params", () => {
    expect(customerIdFromAccountParams(new URLSearchParams("customerId=customer-1"))).toBe("customer-1");
    expect(customerIdFromAccountParams(new URLSearchParams("customer_id=legacy-customer"))).toBe("legacy-customer");
    expect(customerIdFromAccountParams(new URLSearchParams())).toBe("all");
  });
});
