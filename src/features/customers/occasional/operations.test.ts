import { describe, expect, it } from "vitest";
import type { BillingDocumentRow } from "@/features/billing/types";
import type { CashSaleRow, RemitoOption } from "@/features/cash/types";
import {
  buildOccasionalOperations,
  calculateOccasionalTotals,
  canCreateInvoiceBDraftForOccasionalOperation,
  filterOccasionalOperations,
  resolveOccasionalFiscalStatus,
} from "./operations";

const remito = (overrides: Partial<RemitoOption> = {}): RemitoOption => ({
  id: "remito-1",
  doc_type: "REMITO",
  customer_id: null,
  customer_name: "Consumidor final",
  point_of_sale: 1,
  document_number: 42,
  issue_date: "2026-06-08",
  created_at: "2026-06-08T10:00:00.000Z",
  status: "EMITIDO",
  total: 100,
  origin_document_id: null,
  source_document_number_snapshot: null,
  technician_id: null,
  external_invoice_number: null,
  external_invoice_status: null,
  ...overrides,
});

const sale = (overrides: Partial<CashSaleRow> = {}): CashSaleRow => ({
  id: "sale-1",
  sold_at: "2026-06-08T10:15:00.000Z",
  business_date: "2026-06-08",
  amount_total: 100,
  payment_method: "POINT",
  receipt_kind: "REMITO",
  status: "REGISTRADA",
  document_id: "remito-1",
  closure_id: null,
  receipt_reference: "0001-00000042",
  customer_name_snapshot: "Consumidor final",
  notes: null,
  ...overrides,
});

const billingDocument = (overrides: Partial<BillingDocumentRow> = {}): BillingDocumentRow => ({
  id: "billing-1",
  company_id: "company-1",
  source_type: "CASH_SALE_FROM_REMITO",
  source_id: "sale-1",
  source_remito_id: "remito-1",
  related_billing_document_id: null,
  document_kind: "INVOICE",
  invoice_type: "FACTURA_B",
  fiscal_status: "AUTHORIZED",
  provider: "AFIPSDK",
  environment: "dev",
  issuer_tax_id: null,
  issuer_name: null,
  issuer_tax_condition: null,
  receiver_name: "Consumidor final",
  receiver_doc_type: "DNI",
  receiver_doc_number: null,
  receiver_tax_condition: "CONSUMIDOR_FINAL",
  receiver_fiscal_snapshot: null,
  currency: "ARS",
  currency_rate: 1,
  subtotal: 100,
  discount_total: 0,
  tax_total: 0,
  total: 100,
  point_of_sale: 6,
  voucher_number: 1,
  voucher_full_number: "0006-00000001",
  voucher_date: "2026-06-08",
  cae: "CAE",
  cae_expires_at: null,
  authorized_at: "2026-06-08T10:30:00.000Z",
  authorized_by: "user-1",
  provider_errors: null,
  provider_observations: null,
  error_message: null,
  created_at: "2026-06-08T10:20:00.000Z",
  updated_at: "2026-06-08T10:30:00.000Z",
  ...overrides,
});

describe("occasional customer operations", () => {
  it("classifies pending, draft, authorized invoice and authorized credit note states", () => {
    expect(resolveOccasionalFiscalStatus({ remito: remito(), sale: sale(), invoiceB: null, creditNoteB: null })).toBe("PENDING_INVOICE_B");
    expect(resolveOccasionalFiscalStatus({ remito: remito(), sale: sale(), invoiceB: billingDocument({ fiscal_status: "DRAFT" }), creditNoteB: null })).toBe("DRAFT_BILLING");
    expect(resolveOccasionalFiscalStatus({ remito: remito(), sale: sale(), invoiceB: billingDocument(), creditNoteB: null })).toBe("INVOICE_B_AUTHORIZED");
    expect(resolveOccasionalFiscalStatus({
      remito: remito(),
      sale: sale(),
      invoiceB: billingDocument(),
      creditNoteB: billingDocument({
        id: "credit-1",
        source_type: "CREDIT_NOTE_FROM_INVOICE",
        document_kind: "CREDIT_NOTE",
        invoice_type: "NOTA_CREDITO_B",
        related_billing_document_id: "billing-1",
      }),
    })).toBe("CREDIT_NOTE_B_AUTHORIZED");
  });

  it("builds operations without mutating cash or customer account state", () => {
    const operations = buildOccasionalOperations({
      remitos: [remito()],
      sales: [sale()],
      billingDocuments: [],
    });

    expect(operations).toHaveLength(1);
    expect(operations[0].remito.customer_id).toBeNull();
    expect(operations[0].fiscalStatus).toBe("PENDING_INVOICE_B");
    expect(canCreateInvoiceBDraftForOccasionalOperation({
      operation: operations[0],
      billingEnabled: true,
      canCreateBilling: true,
    })).toBe(true);
  });

  it("calculates fiscal totals and filters by payment/fiscal status", () => {
    const invoice = billingDocument();
    const creditNote = billingDocument({
      id: "credit-1",
      source_type: "CREDIT_NOTE_FROM_INVOICE",
      source_id: "billing-1",
      document_kind: "CREDIT_NOTE",
      invoice_type: "NOTA_CREDITO_B",
      related_billing_document_id: "billing-1",
      total: 100,
      voucher_full_number: "0006-00000002",
    });
    const operations = buildOccasionalOperations({
      remitos: [remito(), remito({ id: "remito-2", document_number: 43, total: 50 })],
      sales: [sale(), sale({ id: "sale-2", document_id: "remito-2", amount_total: 50, payment_method: "EFECTIVO" })],
      billingDocuments: [invoice, creditNote],
    });

    const totals = calculateOccasionalTotals(operations);
    expect(totals.authorizedInvoiceBTotal).toBe(100);
    expect(totals.authorizedCreditNoteBTotal).toBe(100);
    expect(totals.netFiscalTotal).toBe(0);
    expect(totals.pendingInvoiceBTotal).toBe(50);

    expect(filterOccasionalOperations(operations, {
      search: "",
      paymentMethod: "EFECTIVO",
      fiscalStatus: "PENDING_INVOICE_B",
      closureStatus: "ALL",
    })).toHaveLength(1);
  });
});
