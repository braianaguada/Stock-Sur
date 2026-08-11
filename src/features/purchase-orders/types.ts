export type PurchaseOrderCurrency = "ARS" | "USD";
export type PurchaseOrderStatus = "DRAFT" | "SENT" | "CANCELLED";

export interface SupplierPurchaseOrder {
  id: string;
  company_id: string;
  supplier_id: string;
  source_catalog_version_id: string;
  order_number: number;
  status: PurchaseOrderStatus;
  supplier_name_snapshot: string;
  notes: string | null;
  totals_by_currency: Partial<Record<PurchaseOrderCurrency, number>>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPurchaseOrderLine {
  id: string;
  company_id: string;
  purchase_order_id: string;
  source_catalog_line_id: string | null;
  line_order: number;
  supplier_code_snapshot: string | null;
  product_name_snapshot: string;
  raw_description_snapshot: string;
  additional_description_snapshot: string | null;
  presentation_raw_snapshot: string | null;
  package_quantity_snapshot: number | null;
  content_value_snapshot: number | null;
  content_unit_snapshot: string | null;
  quantity: number;
  currency: PurchaseOrderCurrency;
  unit_cost: number;
  line_total: number;
  reference_unit_price_snapshot: number | null;
  reference_price_basis_snapshot: string | null;
  created_at: string;
}

export interface CreateSupplierPurchaseOrderInput {
  companyId: string;
  supplierId: string;
  catalogVersionId: string;
  lines: Array<{ catalogLineId: string; quantity: number }>;
  notes?: string | null;
}

export interface UpdateSupplierPurchaseOrderDraftInput {
  companyId: string;
  orderId: string;
  notes?: string | null;
  lines: Array<{ lineId: string; quantity: number }>;
}

export function purchaseOrderActions(status: PurchaseOrderStatus) {
  return {
    canEdit: status === "DRAFT",
    canDelete: status === "DRAFT",
    canSend: status === "DRAFT",
    canCancel: status === "DRAFT" || status === "SENT",
  };
}
