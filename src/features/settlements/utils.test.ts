import { describe, expect, it, vi } from "vitest";
import {
  calculateSettlementTotals,
  formatSettlementNumber,
  headerFormToPayload,
  isDraftSettlement,
  makeExpenseLineDraft,
  makeIncomeLineDraft,
  parseMoneyInput,
} from "@/features/settlements/utils";

vi.stubGlobal("crypto", {
  randomUUID: () => "line-id",
});

describe("settlement utils", () => {
  it("calculates totals from income and expense lines", () => {
    const totals = calculateSettlementTotals(
      [
        { cash_amount: "100", other_amount: "25.50" },
        { cash_amount: "10,25", other_amount: "-8" },
      ],
      [
        { cash_amount: "30", other_amount: "5.25" },
        { cash_amount: "bad-value", other_amount: 4 },
      ],
    );

    expect(totals).toEqual({
      income_cash_total: 110.25,
      income_other_total: 25.5,
      income_total: 135.75,
      expense_cash_total: 30,
      expense_other_total: 9.25,
      expense_total: 39.25,
      settlement_total: 96.5,
    });
  });

  it("normalizes money input without accepting negative or invalid values", () => {
    expect(parseMoneyInput("1,5")).toBe(1.5);
    expect(parseMoneyInput("-1")).toBe(0);
    expect(parseMoneyInput("sin-numero")).toBe(0);
  });

  it("formats settlement numbers and status editability", () => {
    expect(formatSettlementNumber(null)).toBe("Sin numero");
    expect(formatSettlementNumber(7)).toBe("#00007");
    expect(isDraftSettlement("DRAFT")).toBe(true);
    expect(isDraftSettlement("SUBMITTED")).toBe(false);
  });

  it("builds header payload with trimmed optional values", () => {
    expect(headerFormToPayload({
      settlement_date: "2026-06-17",
      period_from: " ",
      period_to: "2026-06-30",
      prepared_by_name: "  Responsable  ",
      notes: "",
    })).toEqual({
      settlement_date: "2026-06-17",
      period_from: null,
      period_to: "2026-06-30",
      prepared_by_name: "Responsable",
      notes: null,
    });
  });

  it("creates line drafts using the selected settlement date", () => {
    expect(makeIncomeLineDraft("2026-06-17")).toMatchObject({ line_date: "2026-06-17", concept: "" });
    expect(makeExpenseLineDraft("2026-06-18")).toMatchObject({ line_date: "2026-06-18", detail: "" });
  });
});
