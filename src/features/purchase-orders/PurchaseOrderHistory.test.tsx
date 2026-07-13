import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PurchaseOrderHistory } from "@/features/purchase-orders/PurchaseOrderHistory";
import type { SupplierPurchaseOrder } from "@/features/purchase-orders/types";

const order: SupplierPurchaseOrder = {
  id: "order-1",
  company_id: "company-a",
  supplier_id: "supplier-a",
  source_catalog_version_id: "version-a",
  order_number: 17,
  status: "DRAFT",
  supplier_name_snapshot: "Silvana Frigerar",
  notes: null,
  totals_by_currency: { ARS: 125000, USD: 80.5 },
  created_by: "user-a",
  created_at: "2026-07-11T12:00:00.000Z",
  updated_at: "2026-07-11T12:00:00.000Z",
};

describe("PurchaseOrderHistory", () => {
  it("shows mixed-currency totals separately", () => {
    render(<PurchaseOrderHistory orders={[order]} />);
    expect(screen.getByText("Orden #17")).toBeInTheDocument();
    expect(screen.getByText(/ARS/)).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
    expect(screen.getByText(/Silvana Frigerar/)).toBeInTheDocument();
  });

  it("has an operational empty state", () => {
    render(<PurchaseOrderHistory orders={[]} />);
    expect(screen.getByText("Todavía no hay órdenes de compra.")).toBeInTheDocument();
  });
});
