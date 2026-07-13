import { CheckCircle2 } from "lucide-react";
import type { PurchaseOrderCurrency, SupplierPurchaseOrder } from "@/features/purchase-orders/types";

export function PurchaseOrderConfirmation({ order }: { order: SupplierPurchaseOrder }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Orden #{order.order_number} generada</p>
          <p className="text-sm">Quedó guardada para {order.supplier_name_snapshot}.</p>
          <div className="mt-2 flex flex-wrap gap-3 tabular-nums">
            {(Object.entries(order.totals_by_currency) as Array<[PurchaseOrderCurrency, number]>).map(([currency, total]) => (
              <span key={currency} className="whitespace-nowrap text-sm font-medium">
                {currency} {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
