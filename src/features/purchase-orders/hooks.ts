import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSupplierPurchaseOrder,
  fetchSupplierPurchaseOrderLines,
  fetchSupplierPurchaseOrders,
} from "@/features/purchase-orders/api";
import type { CreateSupplierPurchaseOrderInput } from "@/features/purchase-orders/types";

export const purchaseOrderKeys = {
  list: (companyId: string | null, supplierId?: string | null) =>
    ["supplier-purchase-orders", companyId ?? "no-company", supplierId ?? "all-suppliers"] as const,
  lines: (companyId: string | null, orderId?: string | null) =>
    ["supplier-purchase-order-lines", companyId ?? "no-company", orderId ?? "no-order"] as const,
};

export function useSupplierPurchaseOrders(companyId: string | null, supplierId?: string | null) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(companyId, supplierId),
    queryFn: () => fetchSupplierPurchaseOrders(companyId!, supplierId ?? undefined),
    enabled: Boolean(companyId),
  });
}

export function useSupplierPurchaseOrderLines(companyId: string | null, orderId?: string | null) {
  return useQuery({
    queryKey: purchaseOrderKeys.lines(companyId, orderId),
    queryFn: () => fetchSupplierPurchaseOrderLines(companyId!, orderId!),
    enabled: Boolean(companyId && orderId),
  });
}

export function useCreateSupplierPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplierPurchaseOrderInput) => createSupplierPurchaseOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(order.company_id, order.supplier_id) });
      void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(order.company_id) });
    },
  });
}
