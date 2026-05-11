import { describe, expect, it } from "vitest";
import { customerAccountPath } from "./routes";

describe("customer account routes", () => {
  it("generates a customer-filtered account statement link", () => {
    expect(customerAccountPath("customer-1")).toBe("/customer-account?customerId=customer-1");
  });

  it("omits the query param without customer", () => {
    expect(customerAccountPath(null)).toBe("/customer-account");
  });
});
