import type { ReactNode } from "react";
import { Banknote, ClipboardCheck, Landmark, Receipt, Smartphone, TrendingDown } from "lucide-react";
import { AmountDisplay, CompactBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CashSummary, ClosureStatus } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
  closureStatus?: ClosureStatus | null;
  movementCount?: number;
  pendingCount?: number;
  onReviewPending?: () => void;
};

function BreakdownRow({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/55 bg-background/64 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="rounded-lg border border-border/60 bg-card p-1.5 text-muted-foreground">
          {icon}
        </span>
        <span className="truncate text-sm text-muted-foreground">{label}</span>
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
    <div className="min-w-0 rounded-2xl border border-border/55 bg-card/72 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <AmountDisplay value={value} size="lg" className={toneClassName} />
    </div>
  );
}

export function CashOverviewPanel({
  summary,
  closureStatus,
  movementCount = 0,
  pendingCount = summary.pendientes,
  onReviewPending,
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
    <Card className="overflow-hidden border-primary/14 bg-gradient-to-br from-card via-card to-primary/5 shadow-[var(--shadow-sm)]">
      <CardContent className="p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="space-y-6 p-6 lg:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Resumen del dia</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Caja operativa</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CompactBadge tone={closureStatus === "CERRADO" ? "success" : "warning"}>
                  {closureStatus === "CERRADO" ? "Caja cerrada" : "Caja abierta"}
                </CompactBadge>
                <CompactBadge tone={pendingCount > 0 ? "warning" : "muted"}>
                  {pendingCount > 0 ? `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}` : "Sin pendientes"}
                </CompactBadge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total vendido del dia</p>
              <AmountDisplay value={summary.total} size="hero" className="max-w-4xl text-5xl font-black text-foreground sm:text-6xl" />
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Venta bruta por todos los medios. La rendicion fisica se controla con efectivo a rendir y gastos en efectivo.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryFact label="Efectivo a rendir" value={summary.efectivoNetoEsperado} tone="success" />
              <SummaryFact label="Gastos efectivo" value={summary.gastosEfectivo} tone="danger" />
              <SummaryFact label="Otros medios" value={digitalTotal} />
              <SummaryFact label="Cuenta corriente" value={summary.cuentaCorriente} />
            </div>

            {summary.gastosEfectivo > 0 || summary.gastosNoEfectivo > 0 || pendingCount > 0 ? (
              <div className="flex flex-wrap gap-2">
                {summary.gastosEfectivo > 0 ? (
                  <CompactBadge tone="danger">
                    <TrendingDown className="mr-1 h-3 w-3" /> Gastos efectivo registrados
                  </CompactBadge>
                ) : null}
                {summary.gastosNoEfectivo > 0 ? (
                  <CompactBadge tone="muted">
                    Gastos no efectivo: {summary.gastosNoEfectivo.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                  </CompactBadge>
                ) : null}
                {pendingCount > 0 && onReviewPending ? (
                  <Button type="button" size="sm" variant="outline" onClick={onReviewPending}>
                    <ClipboardCheck className="mr-2 h-4 w-4" /> Revisar pendientes
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60 bg-[hsl(var(--panel))]/34 p-6 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Composicion</p>
                <p className="text-xs text-muted-foreground">{movementCount} movimiento{movementCount === 1 ? "" : "s"} del dia</p>
              </div>
              <CompactBadge tone="info">Medios de pago</CompactBadge>
            </div>
            <div className="mt-4 space-y-2">
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

export function CashSummaryCards(props: CashSummaryCardsProps) {
  return <CashOverviewPanel {...props} />;
}
