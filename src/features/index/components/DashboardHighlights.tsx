import { ArrowRight, Banknote, PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { formatDashboardPaymentMethod } from "@/features/index/payment-method-label";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function DashboardHighlights({ dashboard }: { dashboard: DashboardInsights }) {
  const payments = dashboard.paymentMethods.slice(0, 4);
  const max = Math.max(...payments.map((item) => item.total), 1);

  return (
    <Card className="flex h-full flex-col border-border/70 shadow-none" aria-labelledby="dashboard-highlights-title">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-5">
        <Banknote className="h-5 w-5" aria-hidden="true" />
        <div><h2 id="dashboard-highlights-title" className="text-base font-semibold">Composición de cobros</h2><p className="text-xs text-muted-foreground">Medios registrados este mes</p></div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        {payments.length ? payments.map((item) => (
          <div key={item.method}>
            <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{formatDashboardPaymentMethod(item.method)}</span><strong className="tabular-nums">{money.format(item.total)}</strong></div>
            <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, item.total / max * 100)}%` }} /></div>
          </div>
        )) : <div className="flex flex-1 flex-col items-center justify-center text-center"><PackageSearch className="h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No hay cobros registrados en el período.</p></div>}
        <Link to="/cash-totals" className="mt-auto flex min-h-10 items-center justify-between rounded-xl border border-border/60 px-3 text-xs font-medium hover:bg-muted/50">Ver totales de caja<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </Card>
  );
}
