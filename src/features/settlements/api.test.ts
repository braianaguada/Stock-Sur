import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSaveSettlementDraftArgs,
  fetchSettlementPreparerName,
  saveSettlementDraft,
} from "@/features/settlements/api";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

describe("settlements api", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("loads the preparer name through the profiles gateway", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { full_name: "  Responsable  " },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    await expect(fetchSettlementPreparerName("user-1")).resolves.toBe("Responsable");
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("full_name");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("builds save draft RPC payload using real DB columns", () => {
    const args = buildSaveSettlementDraftArgs({
      settlementId: "settlement-1",
      headerForm: {
        settlement_date: "2026-06-18",
        period_from: "",
        period_to: "2026-06-30",
        prepared_by_name: "  Responsable  ",
        notes: " Nota ",
      },
      incomeLines: [{
        id: "income-1",
        line_date: "2026-06-18",
        work_order: "OT-1",
        receipt: "R-1",
        quote: "P-1",
        customer_name: "Cliente",
        concept: "Cobro",
        cash_amount: "100",
        other_amount: "50",
        income_type: "Servicio",
      }],
      expenseLines: [{
        id: "expense-1",
        line_date: "2026-06-18",
        receipt: "F-1",
        supplier_name: "Proveedor",
        detail: "Gasto",
        purchase_order: "OC-1",
        cash_amount: "25",
        other_amount: "5",
      }],
    });

    expect(args).toEqual({
      p_settlement_id: "settlement-1",
      p_header: {
        settlement_date: "2026-06-18",
        period_from: null,
        period_to: "2026-06-30",
        prepared_by_name: "Responsable",
        notes: "Nota",
      },
      p_income_lines: [{
        line_date: "2026-06-18",
        work_order: "OT-1",
        receipt: "R-1",
        quote: "P-1",
        customer_name: "Cliente",
        concept: "Cobro",
        cash_amount: 100,
        other_amount: 50,
        income_type: "Servicio",
        display_order: 1,
      }],
      p_expense_lines: [{
        line_date: "2026-06-18",
        receipt: "F-1",
        supplier_name: "Proveedor",
        detail: "Gasto",
        purchase_order: "OC-1",
        cash_amount: 25,
        other_amount: 5,
        display_order: 1,
      }],
    });
    expect(JSON.stringify(args)).not.toContain("receipt_number");
    expect(JSON.stringify(args)).not.toContain("budget_number");
  });

  it("saves a draft through the atomic RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "settlement-1" }, error: null });

    await expect(saveSettlementDraft({
      settlementId: "settlement-1",
      headerForm: {
        settlement_date: "2026-06-18",
        period_from: "",
        period_to: "",
        prepared_by_name: "Responsable",
        notes: "",
      },
      incomeLines: [],
      expenseLines: [],
    })).resolves.toEqual({ id: "settlement-1" });

    expect(rpcMock).toHaveBeenCalledWith("save_settlement_draft", expect.objectContaining({
      p_settlement_id: "settlement-1",
      p_income_lines: [],
      p_expense_lines: [],
    }));
  });
});
