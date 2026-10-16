import { describe, expect, it, vi } from "vitest";
import { buildDailyReport, dailyReportHtml, dailyReportTsv, loadDailyReport } from "./daily-report";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

describe("daily cash report", () => {
  const sale = { id: "1", document_id: "doc", sold_at: "2026-10-16T10:00:00Z", amount_total: 270000, payment_method: "EFECTIVO_REMITO" as const, receipt_kind: "REMITO" as const, receipt_reference: null, status: "REGISTRADA" as const };
  it("uses exact Excel labels and leaves B numbering blank", () => {
    const rows = buildDailyReport([sale, { ...sale, id: "2", payment_method: "POINT" }], [], [], [{ id: "doc", document_number: 1550, external_invoice_number: null, external_invoice_status: null }]);
    expect(rows).toEqual([["REMITO", "X", 7, 1550, 270000, "EFECT REM"], ["FACTURA", "B", 9, "", 270000, "MP. POINT"]]);
    expect(dailyReportTsv(rows)).toBe("REMITO\tX\t7\t1550\t270000,00\tEFECT REM\nFACTURA\tB\t9\t\t270000,00\tMP. POINT");
  });
  it("exports registered A references and negative expenses and returns, excluding cancellations", () => {
    const rows = buildDailyReport([{ ...sale, payment_method: "CUENTA_CORRIENTE", receipt_kind: "FACTURA" }, { ...sale, status: "ANULADA" }], [{ id: "expense", spent_at: "2026-10-16T11:00:00Z", amount_total: 100, expense_kind: "CAJA", cancelled_at: null }], [{ id: "return", occurred_at: "2026-10-16T12:00:00Z", document_id: "doc", signed_amount: -200, cancelled_at: null }], [{ id: "doc", document_number: 1550, external_invoice_number: "0009-00002044", external_invoice_status: "ACTIVE" }]);
    expect(rows).toEqual([["FACTURA", "A", 9, 2044, 270000, "CTA CTE"], ["GASTO", "", "", "", -100, "EFECT REM"], ["REMITO", "X", 7, 1550, -200, "SERVICIOS /REMITO"]]);
  });

  it.each(["EFECTIVO", "EFECTIVO_REMITO", "EFECTIVO_FACTURABLE", "SERVICIOS_REMITO", "POINT", "TRANSFERENCIA", "CUENTA_CORRIENTE"] as const)("uses the active invoice for %s even when the cash receipt was a remito", (payment_method) => {
    const rows = buildDailyReport([{ ...sale, payment_method }], [], [], [{ id: "doc", document_number: 1550, external_invoice_number: "0009-00002044", external_invoice_status: "ACTIVE" }]);
    expect(rows[0].slice(0, 5)).toEqual(["FACTURA", "A", 9, 2044, 270000]);
  });

  it("does not export a cancelled invoice number", () => {
    const rows = buildDailyReport([{ ...sale, payment_method: "EFECTIVO_FACTURABLE", receipt_kind: "FACTURA", receipt_reference: "0009-00002044" }], [], [], [{ id: "doc", document_number: 1550, external_invoice_number: "0009-00002044", external_invoice_status: "VOIDED" }]);
    expect(rows[0].slice(0, 4)).toEqual(["FACTURA", "B", 9, ""]);
  });

  it("copies a bordered table with empty cells and escaped text", () => {
    const html = dailyReportHtml([["FACTURA", "B", 9, "", 270000, "<Point & efectivo>"]]);
    const container = document.createElement("div");
    container.innerHTML = html;
    const cells = container.querySelectorAll("td");
    expect(cells).toHaveLength(6);
    expect(cells[3].textContent).toBe("");
    expect(cells[5].textContent).toBe("<Point & efectivo>");
    expect(container.querySelector("point")).toBeNull();
    for (const cell of cells) expect(cell.style.border).toBe("1px solid #000");
  });

  it("reads every page and scopes all queries to the company and selected day", async () => {
    const queries: { table: string; select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; range: ReturnType<typeof vi.fn> }[] = [];
    from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
        range: vi.fn(async (start: number) => ({ error: null, data: table === "cash_sales"
          ? Array.from({ length: start === 0 ? 500 : 1 }, (_, index) => ({ ...sale, id: String(start + index) }))
          : table === "documents" ? [{ id: "doc", document_number: 1550, external_invoice_number: null, external_invoice_status: null }] : [] })),
      };
      queries.push({ table, ...query });
      return query;
    });
    const rows = await loadDailyReport("company-1", "2026-10-16");
    expect(rows).toHaveLength(501);
    expect(queries.filter((query) => query.table === "cash_sales").map((query) => query.range.mock.calls[0])).toEqual([[0, 499], [500, 999]]);
    for (const query of queries) {
      expect(query.eq).toHaveBeenCalledWith("company_id", "company-1");
      expect(query.select).not.toHaveBeenCalledWith("*");
      if (query.table !== "documents") expect(query.eq).toHaveBeenCalledWith("business_date", "2026-10-16");
    }
  });
});
