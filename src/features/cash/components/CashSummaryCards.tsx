import type { ReactNode } from "react";
import { Banknote, Landmark, Receipt, Smartphone, TrendingDown } from "lucide-react";
import { AmountDisplay, CompactBadge } from "@/components/common/VisualSystem";
import { Card, CardContent } from "@/components/ui/card";
import type { CashSummary, ClosureStatus } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
  closureStatus?: ClosureStatus | null;
  movementCount?: number;
  pendingCount?: number;
};

function BreakdownRow({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/45 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="rounded-md bg-muted/55 p-1.5 text-muted-foreground">
          {icon}
        </span>
        <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <AmountDisplay value={value} size="sm" className="shrink-0 text-right" />
    </div>
  );
}
function SummaryFact({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClassName = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];

  return (
    <div className="min-w-0 border-l border-border/60 pl-4 first:border-l-0 first:pl-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <AmountDisplay value={value} size="lg" className={toneClassName} />
    </div>
  );
}
export function CashOverviewPanel({
  summary,
  closureStatus,
  movementCount = 0,
  pendingCount = summary.pendientes,
}: CashSummaryCardsProps) {
  const digitalTotal = summary.point + summary.transferencia + summary.serviciosRemito;
  const breakdown = [
    {
      label: "Efectivo remito",
      value: summary.efectivoRemito,
      icon: <Banknote className="h-3.5 w-3.5" />,
    },
    {
      label: "Efectivo facturable",
      value: summary.efectivoFacturable,
      icon: <Banknote className="h-3.5 w-3.5" />,
    },
    {
      label: "Servicios / remito",
      value: summary.serviciosRemito,
      icon: <Receipt className="h-3.5 w-3.5" />,
    },
    {
      label: "Point",
      value: summary.point,
      icon: <Smartphone className="h-3.5 w-3.5" />,
    },
    {
      label: "Transferencias",
      value: summary.transferencia,
      icon: <Landmark className="h-3.5 w-3.5" />,
    },
    {
      label: "Cuenta corriente",
      value: summary.cuentaCorriente,
      icon: <Receipt className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <Card className="overflow-hidden border-border/70 bg-card shadow-none">
      <CardContent className="p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5 p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Resumen operativo</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Caja del dia</h2>
              </div>
              <CompactBadge tone={closureStatus === "CERRADO" ? "success" : "warning"}>
                {closureStatus === "CERRADO" ? "Caja cerrada" : "Caja abierta"}
              </CompactBadge>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total vendido del dia</p>
                <AmountDisplay value={summary.total} size="hero" className="max-w-4xl text-4xl font-bold text-foreground sm:text-5xl" />
              </div>
              <p className="text-sm leading-6 text-muted-foreground lg:text-right">
                Venta bruta del dia. La rendicion se controla con efectivo a rendir y gastos en caja.
              </p>
            </div>

            <div className="grid gap-4 rounded-lg border-y border-border/70 py-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryFact label="Efectivo a rendir" value={summary.efectivoNetoEsperado} tone="success" />
              <SummaryFact label="Gastos efectivo" value={summary.gastosEfectivo} tone="danger" />
              <SummaryFact label="Otros medios" value={digitalTotal} />
              <SummaryFact label="Cuenta corriente" value={summary.cuentaCorriente} />
            </div>

            {summary.gastosEfectivo > 0 || summary.gastosNoEfectivo > 0 || pendingCount > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {summary.gastosEfectivo > 0 ? (
                  <CompactBadge tone="danger">
                    <TrendingDown className="mr-1 h-3 w-3" /> Gastos efectivo registrados
                  </CompactBadge>
                ) : null}
                {summary.gastosNoEfectivo > 0 ? (
                  <CompactBadge tone="muted">
                    Gastos fuera de caja: {summary.gastosNoEfectivo.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                  </CompactBadge>
                ) : null}
                {pendingCount > 0 ? (
                  <span className="self-center text-muted-foreground">
                    Nota tecnica: {pendingCount} movimiento{pendingCount === 1 ? "" : "s"} sin comprobante asociado.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60 bg-[hsl(var(--panel))]/28 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Composicion</p>
                <p className="text-xs text-muted-foreground">{movementCount} movimiento{movementCount === 1 ? "" : "s"} del dia</p>
              </div>
            </div>
            <div className="mt-3">
              {breakdown.map((item) => (
                <BreakdownRow key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
