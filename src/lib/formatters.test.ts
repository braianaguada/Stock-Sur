import { describe, expect, it } from "vitest";
import { formatBusinessDate } from "./formatters";

describe("formatters", () => {
  it("formats date-only business dates without UTC day shifts", () => {
    expect(formatBusinessDate("2026-05-09")).toBe("09/05/2026");
  });
});
