import { BarChart3, PackageSearch, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

type PeriodPayload = { timeseries: unknown; products: unknown } | undefined;

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export function DashboardPeriodInsights({ data, loading }: { data: PeriodPayload; loading: boolean }) {
  const products = record(data?.products);
  const totals = record(products.totals);
  const topItems = Array.isArray(products.topItems) ? products.topItems.map(record) : [];
  const series = record(data?.timeseries);
  const buckets = Array.isArray(series.buckets) ? series.buckets.map(record) : [];
  const maxRevenue = Math.max(...buckets.map((bucket) => number(bucket.netRevenue)), 1);

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-12" aria-busy={loading}>
      <Card className="border-border/70 shadow-none xl:col-span-5">
        <div className="flex items-center gap-3 border-b border-border/60 p-5"><TrendingUp className="h-5 w-5" /><div><h2 className="font-semibold">Resultado del período</h2><p className="text-xs text-muted-foreground">Ventas emitidas, costo y ganancia bruta</p></div></div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {[["Venta", totals.revenue], ["Costo", totals.cost], ["Ganancia", totals.grossProfit], ["Cantidad", totals.quantity]].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border/60 bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold tabular-nums">{label === "Cantidad" ? quantity.format(number(value)) : money.format(number(value))}</p></div>
          ))}
        </div>
        <div className="space-y-3 border-t border-border/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evolución de venta neta</p>
          {buckets.length ? <div className="flex h-28 items-end gap-1" aria-label="Gráfico de venta neta por período">{buckets.map((bucket, index) => <div key={`${bucket.periodStart}-${index}`} className="min-w-1 flex-1 rounded-t bg-primary/75" title={`${bucket.periodStart}: ${money.format(number(bucket.netRevenue))}`} style={{ height: `${Math.max(3, number(bucket.netRevenue) / maxRevenue * 100)}%` }} />)}</div> : <p className="text-sm text-muted-foreground">Sin movimientos en el período.</p>}
        </div>
      </Card>

      <Card className="border-border/70 shadow-none xl:col-span-7">
        <div className="flex items-center gap-3 border-b border-border/60 p-5"><BarChart3 className="h-5 w-5" /><div><h2 className="font-semibold">Productos más vendidos</h2><p className="text-xs text-muted-foreground">Cantidad con unidad, facturación, costo y ganancia</p></div></div>
        <div className="divide-y divide-border/50 px-5">
          {topItems.length ? topItems.map((item) => (
            <div key={`${item.itemId}-${item.name}-${item.unit}`} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{String(item.name ?? "Producto")}</p><p className="text-xs text-muted-foreground">{item.sku ? `${item.sku} · ` : ""}{quantity.format(number(item.quantity))} {String(item.unit ?? "un")}</p></div>
              <div className="grid grid-cols-3 gap-3 text-right text-xs"><span><small className="block text-muted-foreground">Venta</small><b>{money.format(number(item.revenue))}</b></span><span><small className="block text-muted-foreground">Costo</small><b>{money.format(number(item.cost))}</b></span><span><small className="block text-muted-foreground">Ganancia</small><b className={number(item.grossProfit) >= 0 ? "text-emerald-600" : "text-destructive"}>{money.format(number(item.grossProfit))}</b></span></div>
            </div>
          )) : <div className="flex min-h-44 flex-col items-center justify-center text-center"><PackageSearch className="h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No hay productos vendidos en el período.</p></div>}
        </div>
      </Card>
    </div>
  );
}
