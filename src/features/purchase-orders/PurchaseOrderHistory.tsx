import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PurchaseOrderCurrency, SupplierPurchaseOrder } from "@/features/purchase-orders/types";

const currencyFormatter = (currency: PurchaseOrderCurrency) => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency,
  currencyDisplay: "code",
});

export function PurchaseOrderHistory({
  orders,
  isLoading = false,
  onOpen,
}: {
  orders: SupplierPurchaseOrder[];
  isLoading?: boolean;
  onOpen?: (order: SupplierPurchaseOrder) => void;
}) {
  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Cargando órdenes…</p>;
  if (orders.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no hay órdenes de compra.</div>;
  }

  return (
    <div className="divide-y rounded-lg border" aria-label="Historial de órdenes de compra">
      {orders.map((order) => (
        <article key={order.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <FileText className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Orden #{order.order_number}</p>
            <p className="truncate text-sm text-muted-foreground" title={order.supplier_name_snapshot}>
              {order.supplier_name_snapshot} · {new Date(order.created_at).toLocaleDateString("es-AR")}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums sm:justify-end">
            {(Object.entries(order.totals_by_currency) as Array<[PurchaseOrderCurrency, number]>).map(([currency, total]) => (
              <span key={currency} className="whitespace-nowrap text-sm font-semibold">{currencyFormatter(currency).format(total)}</span>
            ))}
          </div>
          {onOpen ? <Button type="button" variant="outline" size="sm" onClick={() => onOpen(order)}>Ver detalle</Button> : null}
        </article>
      ))}
    </div>
  );
}
