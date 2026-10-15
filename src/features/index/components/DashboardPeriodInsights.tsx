import { BarChart3, PackageSearch, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { lazy, Suspense } from "react";
import { MetricCard, MetricGrid } from "@/components/common/VisualSystem";
import { buildItemDisplayName } from "@/lib/item-display";
import { record, records, number, type PeriodPayload } from "../dashboard-period";

const PeriodChart = lazy(() => import("./DashboardPeriodChart"));

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

export function DashboardPeriodInsights({ data, loading }: { data: PeriodPayload | undefined; loading: boolean }) {
  const products = record(data?.products);
  const totals = record(products.totals);
  const topItems = Array.isArray(products.topItems) ? products.topItems.map(record) : [];
  const series = record(data?.timeseries);
  const buckets = records(series.buckets);
  const revenue = number(totals.revenue);
  const cost = number(totals.cost);
  const soldQuantity = number(totals.quantity);
  const grossProfit = number(totals.grossProfit);
  const grossMargin = revenue ? grossProfit / revenue * 100 : 0;
  const averageUnitPrice = soldQuantity ? revenue / soldQuantity : 0;

  return (
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-12" aria-busy={loading}>
      <Card className="border-border/70 shadow-none xl:col-span-5">
        <div className="flex items-center gap-3 border-b border-border/60 p-5"><TrendingUp className="h-5 w-5" /><div><h2 className="font-semibold">Resultado del período</h2><p className="text-xs text-muted-foreground">Ventas emitidas, costo y ganancia bruta</p></div></div>
        <div className="p-5"><MetricGrid columns={3}>
          {[["Venta", revenue, "money"], ["Costo", cost, "money"], ["Ganancia", grossProfit, "money"], ["Margen bruto", grossMargin, "percent"], ["Cantidad vendida", soldQuantity, "quantity"], ["Precio promedio", averageUnitPrice, "money"]].map(([label, value, format]) => (
            <MetricCard key={String(label)} label={String(label)} format="plain" value={format === "quantity" ? quantity.format(number(value)) : format === "percent" ? `${number(value).toFixed(1)}%` : money.format(number(value))} />
          ))}
        </MetricGrid></div>
        <div className="space-y-3 border-t border-border/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evolución de venta neta</p>
          <p className="text-xs text-muted-foreground">Remitos emitidos menos devoluciones, sin impuestos. Los importes de productos incluyen impuestos.</p>
          {buckets.some(bucket => number(bucket.documentCount) > 0) ? <Suspense fallback={<p role="status">Cargando gráfico…</p>}><PeriodChart buckets={buckets} /></Suspense> : <p className="text-sm text-muted-foreground">Sin movimientos en el período.</p>}
        </div>
      </Card>

      <Card className="border-border/70 shadow-none xl:col-span-7">
        <div className="flex items-center gap-3 border-b border-border/60 p-5"><BarChart3 className="h-5 w-5" /><div><h2 className="font-semibold">Productos más vendidos</h2><p className="text-xs text-muted-foreground">Cantidad con unidad, facturación, costo y ganancia</p></div></div>
        <div className="divide-y divide-border/50 px-5">
          {topItems.length ? topItems.map((item) => (
            <div key={`${item.itemId}-${item.name}-${item.unit}`} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0"><p className="break-words text-sm font-semibold">{buildItemDisplayName({ name: String(item.name ?? "Producto"), brand: typeof item.brand === "string" ? item.brand : null, model: typeof item.model === "string" ? item.model : null, attributes: typeof item.attributes === "string" ? item.attributes : null })}</p><p className="text-xs text-muted-foreground">{item.sku ? `${item.sku} · ` : ""}{quantity.format(number(item.quantity))} {String(item.unit ?? "un")}</p></div>
              <div className="grid grid-cols-3 gap-2 text-right text-xs [&>span]:min-w-0 [&_b]:break-words"><span><small className="block text-muted-foreground">Venta</small><b>{money.format(number(item.revenue))}</b></span><span><small className="block text-muted-foreground">Costo</small><b>{money.format(number(item.cost))}</b></span><span><small className="block text-muted-foreground">Ganancia</small><b className={number(item.grossProfit) >= 0 ? "text-emerald-600" : "text-destructive"}>{money.format(number(item.grossProfit))}</b></span></div>
            </div>
          )) : <div className="flex min-h-44 flex-col items-center justify-center text-center"><PackageSearch className="h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No hay productos vendidos en el período.</p></div>}
        </div>
      </Card>
    </div>
  );
}
