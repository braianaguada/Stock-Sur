import { describe, expect, it } from "vitest";
import { buildSettlementPrintHtml } from "./print";

describe("buildSettlementPrintHtml", () => {
  it("prints the requested columns, filtered totals and receipt footer", () => {
    const html = buildSettlementPrintHtml({
      companyName: "Empresa Uno",
      companyLogoUrl: "https://example.com/company-logo.png",
      settlementNumber: 12,
      status: "SUBMITTED",
      createdAt: "2026-06-19T10:30:00Z",
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
      printNote: "Entregar comprobantes originales.",
    });

    expect(html).toContain("Fecha cobro");
    expect(html).toContain("Transf/Tarj/Cheq");
    expect(html).toContain("FC Nº");
    expect(html).toContain("Total a rendir");
    expect(html).toContain("Creado");
    expect(html).toContain("Cantidad ingresos");
    expect(html).toContain("Cantidad egresos");
    expect(html).toContain("Firma");
    expect(html).toContain("Aclaracion");
    expect(html).toContain("<span>Fecha</span>");
    expect(html).toContain("125");
    expect(html).toContain("https://example.com/company-logo.png");
    expect(html).toContain("Entregar comprobantes originales.");
  });
});
