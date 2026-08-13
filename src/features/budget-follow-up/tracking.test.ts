import { describe, expect, it } from "vitest";
import { buildTrackedBudgets, resolveBudgetTrackingState } from "./tracking";
import type { BudgetDocument, BudgetFollowUp } from "./types";

const budget = (overrides: Partial<BudgetDocument> = {}): BudgetDocument => ({
  id: "budget-1", status: "ENVIADO", point_of_sale: 1, document_number: 4,
  issue_date: "2026-08-01", valid_until: "2026-08-31", customer_name: "Cliente", total: 100,
  ...overrides,
});

const followUp = (overrides: Partial<BudgetFollowUp> = {}): BudgetFollowUp => ({
  id: "follow-1", company_id: "company-1", document_id: "budget-1", priority: "NORMAL",
  next_contact_on: "2026-08-14", last_contacted_at: null, contact_count: 0, notes: null,
  created_by: "user-1", updated_by: "user-1", created_at: "2026-08-01", updated_at: "2026-08-01",
  ...overrides,
});

describe("budget tracking", () => {
  it("prioritizes an overdue contact over document expiration", () => {
    expect(resolveBudgetTrackingState(budget({ valid_until: "2026-08-10" }), followUp({ next_contact_on: "2026-08-12" }), "2026-08-13")).toBe("OVERDUE");
  });

  it("keeps final document states resolved", () => {
    expect(resolveBudgetTrackingState(budget({ status: "APROBADO" }), followUp({ next_contact_on: "2026-08-01" }), "2026-08-13")).toBe("RESOLVED");
  });

  it("sorts actionable budgets before resolved budgets and high priority first", () => {
    const result = buildTrackedBudgets(
      [budget({ id: "resolved", status: "RECHAZADO" }), budget({ id: "normal" }), budget({ id: "high" })],
      [followUp({ document_id: "normal", next_contact_on: "2026-08-12" }), followUp({ document_id: "high", priority: "HIGH", next_contact_on: "2026-08-12" })],
      "2026-08-13",
    );
    expect(result.map((row) => row.id)).toEqual(["high", "normal", "resolved"]);
  });
});
