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
      preparedByName: "Braian Aguada",
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
    expect(html).toContain("Braian Aguada");
    expect(html).toContain("20/06/2026 a 21/06/2026");
    expect(html).not.toContain("Fechas impresas");
    expect(html).not.toContain("<span>Notas</span>");
    expect(html).toContain("margin-top:auto");
  });

  it("keeps large income and expense tables printable across multiple pages", () => {
    const incomeLines = Array.from({ length: 45 }, (_, index) => ({
      id: `income-${index}`,
      line_date: "2026-06-20",
      work_order: `OT-${index}`,
      receipt: `R-${index}`,
      quote: `P-${index}`,
      customer_name: `Cliente ${index}`,
      concept: `Cobro ${index}`,
      cash_amount: "100",
      other_amount: "50",
      income_type: "Venta",
    }));
    const expenseLines = Array.from({ length: 45 }, (_, index) => ({
      id: `expense-${index}`,
      line_date: "2026-06-21",
      receipt: `FC-${index}`,
      supplier_name: `Proveedor ${index}`,
      detail: `Compra ${index}`,
      purchase_order: `OC-${index}`,
      cash_amount: "25",
      other_amount: "0",
    }));

    const html = buildSettlementPrintHtml({
      companyName: "Empresa Uno",
      settlementNumber: 13,
      status: "DRAFT",
      createdAt: "2026-06-24T10:30:00Z",
      header: {
        settlement_date: "2026-06-24",
        period_from: "",
        period_to: "",
        prepared_by_name: "Braian",
        notes: "",
      },
      incomeLines,
      expenseLines,
    });

    expect(html.match(/<tr>/g)).toHaveLength(92);
    expect(html).toContain("45 filas");
    expect(html).toContain("Cliente 44");
    expect(html).toContain("Proveedor 44");
    expect(html).toContain("6.750,00");
    expect(html).toContain("1.125,00");
    expect(html).toContain("5.625,00");
    expect(html).toContain("thead{display:table-header-group}");
    expect(html).toContain("page-break-inside:avoid");
    expect(html).toContain(".content{display:block");
    expect(html).toContain(".summary{margin-top:8mm}");
  });
});
