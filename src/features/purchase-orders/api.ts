import { supabase } from "@/integrations/supabase/client";
import type {
  CreateSupplierPurchaseOrderInput,
  PurchaseOrderStatus,
  SupplierPurchaseOrder,
  SupplierPurchaseOrderLine,
  UpdateSupplierPurchaseOrderDraftInput,
} from "@/features/purchase-orders/types";

type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type PurchaseOrderClient = {
  rpc: (
    name:
      | "create_supplier_purchase_order"
      | "update_supplier_purchase_order_draft"
      | "transition_supplier_purchase_order"
      | "delete_supplier_purchase_order_draft",
    args: Record<string, unknown>,
  ) => QueryResult<SupplierPurchaseOrder | null>;
  from: (table: "supplier_purchase_orders" | "supplier_purchase_order_lines") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => unknown;
    };
  };
};

const client = supabase as unknown as PurchaseOrderClient;

export async function createSupplierPurchaseOrder(input: CreateSupplierPurchaseOrderInput) {
  const { data, error } = await client.rpc("create_supplier_purchase_order", {
    p_company_id: input.companyId,
    p_supplier_id: input.supplierId,
    p_catalog_version_id: input.catalogVersionId,
    p_lines: input.lines.map((line) => ({
      catalog_line_id: line.catalogLineId,
      quantity: line.quantity,
    })),
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La orden no pudo ser creada");
  return data;
}

export async function fetchSupplierPurchaseOrders(companyId: string, supplierId?: string) {
  const base = client.from("supplier_purchase_orders").select("*");
  const companyQuery = base.eq("company_id", companyId) as {
    eq: (column: string, value: string) => unknown;
    order: (column: string, options: { ascending: boolean }) => QueryResult<SupplierPurchaseOrder[]>;
  };
  const query = supplierId
    ? companyQuery.eq("supplier_id", supplierId) as { order: typeof companyQuery.order }
    : companyQuery;
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSupplierPurchaseOrderLines(companyId: string, orderId: string) {
  const base = client.from("supplier_purchase_order_lines").select("*");
  const companyQuery = base.eq("company_id", companyId) as {
    eq: (column: string, value: string) => { order: (column: string) => QueryResult<SupplierPurchaseOrderLine[]> };
  };
  const { data, error } = await companyQuery.eq("purchase_order_id", orderId).order("line_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateSupplierPurchaseOrderDraft(input: UpdateSupplierPurchaseOrderDraftInput) {
  const { data, error } = await client.rpc("update_supplier_purchase_order_draft", {
    p_company_id: input.companyId,
    p_order_id: input.orderId,
    p_notes: input.notes ?? null,
    p_lines: input.lines.map((line) => ({ line_id: line.lineId, quantity: line.quantity })),
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("El borrador no pudo ser actualizado");
  return data;
}

export async function transitionSupplierPurchaseOrder(
  companyId: string,
  orderId: string,
  targetStatus: Extract<PurchaseOrderStatus, "SENT" | "CANCELLED">,
) {
  const { data, error } = await client.rpc("transition_supplier_purchase_order", {
    p_company_id: companyId,
    p_order_id: orderId,
    p_target_status: targetStatus,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("El estado de la orden no pudo ser actualizado");
  return data;
}

export async function deleteSupplierPurchaseOrderDraft(companyId: string, orderId: string) {
  const { error } = await client.rpc("delete_supplier_purchase_order_draft", {
    p_company_id: companyId,
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
}
