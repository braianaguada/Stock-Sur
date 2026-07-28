import { Banknote, Landmark, Receipt, Smartphone } from "lucide-react";
import {
  CountBadge,
  InfoBadge,
  MetricCard,
  MetricGrid,
  MoneyCell,
  StatusBadge,
} from "@/components/common/VisualSystem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashSummary } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
  movementCount?: number;
  pendingCount?: number;
};

export function CashOverviewPanel({
  summary,
  movementCount = 0,
  pendingCount = summary.pendientes,
}: CashSummaryCardsProps) {
  const digitalTotal = summary.point + summary.transferencia + summary.serviciosRemito;
  const breakdown = [
    { label: "Efectivo remito", value: summary.efectivoRemito, icon: Banknote },
    { label: "Efectivo facturable", value: summary.efectivoFacturable, icon: Banknote },
    { label: "Servicios / remito", value: summary.serviciosRemito, icon: Receipt },
    { label: "Point", value: summary.point, icon: Smartphone },
    { label: "Transferencias", value: summary.transferencia, icon: Landmark },
    { label: "Cuenta corriente", value: summary.cuentaCorriente, icon: Receipt },
  ];

  return (
    <section className="space-y-4" aria-labelledby="cash-overview-title">
      <div>
        <h2 id="cash-overview-title" className="text-lg font-semibold">Panorama de la jornada</h2>
        <p className="text-sm text-muted-foreground">
          Balance esperado, actividad y composición de la fecha operativa.
        </p>
      </div>

      <MetricGrid>
        <MetricCard label="Efectivo a rendir" value={summary.efectivoNetoEsperado} helper="Saldo esperado después de gastos" tone="success" />
        <MetricCard label="Total vendido" value={summary.total} helper="Venta bruta de la jornada" tone="info" />
        <MetricCard label="Gastos en efectivo" value={summary.gastosEfectivo} helper="Egresos que reducen la caja física" tone={summary.gastosEfectivo > 0 ? "danger" : "muted"} />
        <MetricCard label="Otros medios" value={digitalTotal} helper="Servicios, Point y transferencias" />
      </MetricGrid>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Composición por medio</CardTitle>
            <CardDescription>Desglose verificable de los importes de la jornada.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <CountBadge>{movementCount} movimiento{movementCount === 1 ? "" : "s"}</CountBadge>
            {pendingCount > 0 ? <StatusBadge tone="warning">{pendingCount} sin comprobante</StatusBadge> : null}
            {summary.gastosNoEfectivo > 0 ? <InfoBadge>Gastos fuera de caja registrados</InfoBadge> : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
            {breakdown.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex min-w-0 items-center justify-between gap-4 border-b border-border/60 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </div>
                <MoneyCell value={value} className="shrink-0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
