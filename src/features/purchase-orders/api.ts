import { supabase } from "@/integrations/supabase/client";
import type {
  CreateSupplierPurchaseOrderInput,
  SupplierPurchaseOrder,
  SupplierPurchaseOrderLine,
} from "@/features/purchase-orders/types";

type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type PurchaseOrderClient = {
  rpc: (name: "create_supplier_purchase_order", args: Record<string, unknown>) => QueryResult<SupplierPurchaseOrder>;
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
