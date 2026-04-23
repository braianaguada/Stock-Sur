import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { currency, formatDateTime } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import type { CashClosureRow } from "../types";

type CashClosureTabProps = {
  effectiveClosure: CashClosureRow | null;
  closureLoading: boolean;
  closureError: unknown;
  closeNotes: string;
  onCloseNotesChange: (value: string) => void;
  onRecalculate: () => void;
  onCloseClosure: () => void;
  onOpenSummary: (closureId: string) => void;
  closePending: boolean;
  canCloseCash: boolean;
};

const tileToneClasses = {
  success: "from-card via-card to-success/12 before:bg-success/75",
  warning: "from-card via-card to-warning/16 before:bg-warning/80",
  info: "from-card via-card to-info/12 before:bg-info/75",
  lime: "from-card via-card to-lime-500/12 before:bg-lime-500/80",
  amber: "from-card via-card to-amber-400/12 before:bg-amber-400/80",
  slate: "from-card via-card to-slate-500/10 before:bg-slate-500/65",
} as const;

export function CashClosureTab({
  effectiveClosure,
  closureLoading,
  closureError,
  closeNotes,
  onCloseNotesChange,
  onRecalculate,
  onCloseClosure,
  onOpenSummary,
  closePending,
  canCloseCash,
}: CashClosureTabProps) {
  const summaryTiles = [
    {
      label: "Efectivo a rendir",
      value: Number(effectiveClosure?.expected_cash_to_render ?? 0),
      tone: "success" as const,
    },
    {
      label: "Efectivo remito",
      value: Number(effectiveClosure?.expected_cash_remito_total ?? 0),
      tone: "lime" as const,
    },
    {
      label: "Efectivo facturable",
      value: Number(effectiveClosure?.expected_cash_facturable_total ?? 0),
      tone: "warning" as const,
    },
    {
      label: "Servicios / remito",
      value: Number(effectiveClosure?.expected_services_remito_total ?? 0),
      tone: "amber" as const,
    },
    {
      label: "Point esperado",
      value: Number(effectiveClosure?.expected_point_sales_total ?? 0),
      tone: "info" as const,
    },
    {
      label: "Transferencias esperadas",
      value: Number(effectiveClosure?.expected_transfer_sales_total ?? 0),
      tone: "info" as const,
    },
    {
      label: "Cuenta corriente",
      value: Number(effectiveClosure?.expected_account_sales_total ?? 0),
      tone: "slate" as const,
    },
    {
      label: "Total ventas",
      value: Number(effectiveClosure?.expected_sales_total ?? 0),
      tone: "warning" as const,
    },
  ];

  return (
    <Card className="shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Cierre diario</CardTitle>
          <CardDescription>Cierre operativo del día con los totales esperados y el resumen imprimible para control.</CardDescription>
        </div>
        <Badge
          variant="outline"
          className={effectiveClosure?.status === "CERRADO"
            ? "border-success/18 bg-success/10 text-success"
            : "border-warning/18 bg-warning/12 text-warning"}
        >
          {effectiveClosure?.status === "CERRADO" ? "Cerrado" : "Abierto"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {closureError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {getErrorMessage(closureError, "No se pudo cargar el cierre diario.")}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryTiles.map((tile) => (
            <Card
              key={tile.label}
              className={`relative overflow-hidden bg-gradient-to-br ${tileToneClasses[tile.tone]} before:absolute before:inset-x-5 before:top-0 before:h-px shadow-[var(--shadow-xs)]`}
            >
              <CardHeader className="gap-2 pb-4">
                <CardDescription>{tile.label}</CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {closureLoading ? "..." : currency.format(tile.value)}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="border-border/60 bg-[hsl(var(--panel))]/40">
              <CardContent className="p-4 text-sm leading-7 text-muted-foreground">
              El conteo físico del efectivo se completa sobre el resumen impreso. Desde esta pantalla solo cerrás la caja del sistema y dejás observaciones.
              </CardContent>
            </Card>
            <div className="space-y-2">
              <Label htmlFor="close-notes">Observaciones del cierre</Label>
              <Textarea
                id="close-notes"
                rows={5}
                value={closeNotes}
                onChange={(event) => onCloseNotesChange(event.target.value)}
                disabled={effectiveClosure?.status === "CERRADO" || !canCloseCash}
              />
            </div>
          </div>

          <Card className="border-border/60 bg-[hsl(var(--panel))]/42">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resumen operativo</h3>
              <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Efectivo esperado</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_cash_to_render ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Efectivo remito</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_cash_remito_total ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Efectivo facturable</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_cash_facturable_total ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Servicios / remito</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_services_remito_total ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total ventas</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_sales_total ?? 0))}</span>
              </div>
              <div className="border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground">
                  Estado del cierre: {effectiveClosure?.status === "CERRADO"
                    ? `cerrado el ${formatDateTime(effectiveClosure.closed_at ?? null)}`
                    : "todavía abierto"}
                </p>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onCloseClosure} disabled={closureLoading || closePending || effectiveClosure?.status === "CERRADO" || Boolean(closureError) || !canCloseCash}>
            {closePending ? "Cerrando..." : "Cerrar caja"}
          </Button>
          <Button variant="outline" onClick={onRecalculate}>
            Recalcular
          </Button>
          {effectiveClosure?.status === "CERRADO" && effectiveClosure?.id ? (
            <Button variant="outline" onClick={() => onOpenSummary(effectiveClosure.id)}>
              Ver resumen
            </Button>
          ) : null}
          {effectiveClosure?.status === "CERRADO" ? <p className="text-sm text-muted-foreground">El cierre ya está bloqueado. Solo queda disponible para consulta.</p> : null}
          {!canCloseCash ? <p className="text-sm text-muted-foreground">Solo administración puede cerrar o modificar el cierre diario.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
