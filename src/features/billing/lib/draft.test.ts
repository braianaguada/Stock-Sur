import { describe, expect, it } from "vitest";
import type { CashMovementRow } from "@/features/cash/types";
import { canShowCreateBillingDraftAction, getBillingDraftBlockReason } from "./draft";

const baseSale: CashMovementRow = {
  id: "sale-1",
  movement_kind: "SALE",
  sold_at: "2026-06-02T12:00:00-03:00",
  business_date: "2026-06-02",
  amount_total: 100,
  display_amount: 100,
  payment_method: "EFECTIVO_REMITO",
  receipt_kind: "REMITO",
  status: "COMPROBANTADA",
  document_id: "remito-1",
  closure_id: null,
  receipt_reference: "0001-00000001",
  customer_name_snapshot: null,
  notes: null,
};

describe("billing draft action rules", () => {
  it("shows the action only for enabled remito sales without active billing document", () => {
    expect(canShowCreateBillingDraftAction({
      billingEnabled: true,
      canCreate: true,
      sale: baseSale,
      billedSourceIds: new Set(),
    })).toBe(true);
  });

  it("hides the action when billing is disabled or the user cannot create billing drafts", () => {
    expect(canShowCreateBillingDraftAction({
      billingEnabled: false,
      canCreate: true,
      sale: baseSale,
      billedSourceIds: new Set(),
    })).toBe(false);
    expect(canShowCreateBillingDraftAction({
      billingEnabled: true,
      canCreate: false,
      sale: baseSale,
      billedSourceIds: new Set(),
    })).toBe(false);
  });

  it("hides the action when the sale already has an active billing document", () => {
    expect(canShowCreateBillingDraftAction({
      billingEnabled: true,
      canCreate: true,
      sale: baseSale,
      billedSourceIds: new Set(["sale-1"]),
    })).toBe(false);
    expect(getBillingDraftBlockReason({
      billingEnabled: true,
      canCreate: true,
      sale: baseSale,
      billedSourceIds: new Set(["sale-1"]),
    })).toBe("Ya existe un borrador fiscal para esta venta");
  });

  it("blocks annulled sales and sales without remito", () => {
    expect(canShowCreateBillingDraftAction({
      billingEnabled: true,
      canCreate: true,
      sale: { ...baseSale, status: "ANULADA" },
      billedSourceIds: new Set(),
    })).toBe(false);
    expect(canShowCreateBillingDraftAction({
      billingEnabled: true,
      canCreate: true,
      sale: { ...baseSale, receipt_kind: "PENDIENTE", document_id: null },
      billedSourceIds: new Set(),
    })).toBe(false);
  });
});
