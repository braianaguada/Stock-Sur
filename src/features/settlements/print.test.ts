import { describe, expect, it } from "vitest";
import { buildSettlementPrintHtml } from "./print";

describe("buildSettlementPrintHtml", () => {
  it("prints the requested columns, filtered totals and receipt footer", () => {
    const html = buildSettlementPrintHtml({
      companyName: "Empresa Uno",
      settlementNumber: 12,
      status: "SUBMITTED",
      header: {
        settlement_date: "2026-06-24",
        period_from: "",
        period_to: "",
        prepared_by_name: "Braian",
        notes: "",
      },
      incomeLines: [{
        id: "income-1",
        line_date: "2026-06-20",
        work_order: "OT-8",
        receipt: "R-3",
        quote: "P-2",
        customer_name: "Cliente",
        concept: "Cobro",
        cash_amount: "100",
        other_amount: "50",
        income_type: "Venta",
      }],
      expenseLines: [{
        id: "expense-1",
        line_date: "2026-06-21",
        receipt: "FC-9",
        supplier_name: "Proveedor",
        detail: "Compra",
        purchase_order: "OC-7",
        cash_amount: "25",
        other_amount: "0",
      }],
      filterFrom: "2026-06-20",
      filterTo: "2026-06-21",
    });

    expect(html).toContain("FECHA COBRO");
    expect(html).toContain("TRANSF/TARJ/CHEQ");
    expect(html).toContain("FC Nº");
    expect(html).toContain("Total a rendir");
    expect(html).toContain("Firma");
    expect(html).toContain("Aclaracion");
    expect(html).toContain("Fecha de rendicion");
    expect(html).toContain("125");
  });
});
