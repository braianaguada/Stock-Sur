import { describe, expect, it } from "vitest";
import { buildAccountStatement, formatDocumentReference, type AccountStatementSource } from "./accountStatement";

const baseEntry: AccountStatementSource = {
  id: "entry-1",
  company_id: "company-1",
  customer_id: "customer-1",
  customer_name: "Cliente Norte",
  customer_is_occasional: false,
  entry_type: "DEBIT",
  origin_type: "DOCUMENT",
  origin_id: "document-1",
  document_id: "document-1",
  cash_sale_id: null,
  amount: 100,
  business_date: "2026-04-01",
  description: "Debito por remito",
  notes: null,
  metadata: null,
  document: {
    id: "document-1",
    doc_type: "REMITO",
    point_of_sale: 1,
    document_number: 25,
    external_invoice_number: null,
    issue_date: "2026-04-01",
  },
  cashSale: null,
};

function entry(overrides: Partial<AccountStatementSource>): AccountStatementSource {
  return { ...baseEntry, ...overrides };
}

describe("account statement", () => {
  it("marks a debit without credit as pending", () => {
    const { rows } = buildAccountStatement([baseEntry], {}, "2026-04-10");
    expect(rows[0].status).toBe("pending");
  });

  it("marks an overdue debit as overdue", () => {
    const { rows } = buildAccountStatement([baseEntry], {}, "2026-05-10");
    expect(rows[0].due_date).toBe("2026-05-01");
    expect(rows[0].status).toBe("overdue");
  });

  it("shows a credit as payment", () => {
    const { rows, summary } = buildAccountStatement([
      entry({
        id: "entry-2",
        entry_type: "CREDIT",
        origin_type: "MANUAL",
        origin_id: "manual-1",
        document_id: null,
        amount: 40,
        business_date: "2026-04-02",
        description: "Cobro",
      }),
    ]);
    expect(rows[0].status).toBe("payment");
    expect(summary.periodPayments).toBe(40);
  });

  it("calculates customer balance", () => {
    const { summary } = buildAccountStatement([
      baseEntry,
      entry({ id: "entry-2", entry_type: "CREDIT", origin_type: "MANUAL", origin_id: "manual-1", document_id: null, amount: 35 }),
    ]);
    expect(summary.balance).toBe(65);
  });

  it("filters by date range", () => {
    const { rows } = buildAccountStatement([
      baseEntry,
      entry({ id: "entry-2", business_date: "2026-05-01", origin_id: "document-2" }),
    ], { from: "2026-05-01", to: "2026-05-31" });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("entry-2");
  });

  it("does not include occasional customers", () => {
    const { rows } = buildAccountStatement([entry({ customer_is_occasional: true })]);
    expect(rows).toHaveLength(0);
  });

  it("shows document reference", () => {
    const { rows } = buildAccountStatement([baseEntry]);
    expect(rows[0].reference).toBe("REMITO 0001-00000025");
  });

  it("prefers external invoice reference", () => {
    expect(formatDocumentReference({ ...baseEntry.document!, external_invoice_number: "F-0003-42" })).toBe("Factura F-0003-42");
  });

  it("shows external invoice reference on statement rows", () => {
    const { rows } = buildAccountStatement([
      entry({
        document: { ...baseEntry.document!, external_invoice_number: "F-0003-42" },
      }),
    ]);

    expect(rows[0].reference).toBe("Factura F-0003-42");
  });

  it("returns empty state data without movements", () => {
    const { rows, summary } = buildAccountStatement([]);
    expect(rows).toEqual([]);
    expect(summary).toEqual({ balance: 0, overdueDebt: 0, notDueDebt: 0, periodPayments: 0, movementsCount: 0 });
  });
});
