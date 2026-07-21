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
import type { CashSummary, ClosureStatus } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
  closureStatus?: ClosureStatus | null;
  movementCount?: number;
  pendingCount?: number;
};

export function CashOverviewPanel({
  summary,
  closureStatus,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cash-overview-title" className="text-lg font-semibold">Resumen operativo</h2>
          <p className="text-sm text-muted-foreground">Venta, efectivo esperado y composición de la fecha seleccionada.</p>
        </div>
        <StatusBadge tone={closureStatus === "CERRADO" ? "success" : "warning"}>
          {closureStatus === "CERRADO" ? "Caja cerrada" : "Caja abierta"}
        </StatusBadge>
      </div>

      <MetricGrid>
        <MetricCard label="Total vendido" value={summary.total} helper="Venta bruta del día" tone="info" />
        <MetricCard label="Efectivo a rendir" value={summary.efectivoNetoEsperado} helper="Efectivo esperado después de gastos" tone="success" />
        <MetricCard label="Gastos en efectivo" value={summary.gastosEfectivo} helper="Resta de la caja física" tone={summary.gastosEfectivo > 0 ? "danger" : "muted"} />
        <MetricCard label="Otros medios" value={digitalTotal} helper="Servicios, Point y transferencias" />
      </MetricGrid>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Composición</CardTitle>
            <CardDescription>Desglose de los importes que forman el resumen.</CardDescription>
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
