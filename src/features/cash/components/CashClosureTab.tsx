import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountDisplay, CompactBadge } from "@/components/common/VisualSystem";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/formatters";
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

function DetailLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <AmountDisplay size="sm" value={value} className="text-right" />
    </div>
  );
}

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
  const cashBeforeExpenses =
    Number(effectiveClosure?.expected_cash_remito_total ?? 0) +
    Number(effectiveClosure?.expected_cash_facturable_total ?? 0);
  const digitalTotal =
    Number(effectiveClosure?.expected_point_sales_total ?? 0) +
    Number(effectiveClosure?.expected_transfer_sales_total ?? 0) +
    Number(effectiveClosure?.expected_services_remito_total ?? 0);
  const statusLabel = effectiveClosure?.status === "CERRADO" ? "Cerrado" : "Abierto";
  const statusDescription = effectiveClosure?.status === "CERRADO"
    ? `Cerrado el ${formatDateTime(effectiveClosure.closed_at ?? null)}`
    : "Listo para revisar y cerrar cuando los movimientos esten controlados.";

  return (
    <Card className="shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Cierre diario</CardTitle>
          <CardDescription>Pantalla de decision para validar efectivo, otros medios y estado del cierre.</CardDescription>
        </div>
        <Badge
          variant="outline"
          className={effectiveClosure?.status === "CERRADO"
            ? "border-success/18 bg-success/10 text-success"
            : "border-warning/18 bg-warning/12 text-warning"}
        >
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {closureError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {getErrorMessage(closureError, "No se pudo cargar el cierre diario.")}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-success/18 bg-gradient-to-br from-success/10 via-card to-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-success">Efectivo esperado</p>
            <AmountDisplay
              value={closureLoading ? "..." : Number(effectiveClosure?.expected_cash_to_render ?? 0)}
              size="hero"
              className="mt-2 font-black text-success"
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/55 bg-card/72 p-3">
                <p className="text-xs text-muted-foreground">Efectivo antes de gastos</p>
                <AmountDisplay value={cashBeforeExpenses} size="sm" className="mt-1" />
              </div>
              <div className="rounded-xl border border-border/55 bg-card/72 p-3">
                <p className="text-xs text-muted-foreground">Gastos efectivo</p>
                <AmountDisplay value={Number(effectiveClosure?.expected_cash_expenses_total ?? 0)} size="sm" className="mt-1 text-destructive" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Estado del cierre</p>
                <p className="mt-1 text-sm text-muted-foreground">{statusDescription}</p>
              </div>
              <CompactBadge tone={effectiveClosure?.status === "CERRADO" ? "success" : "warning"}>
                {statusLabel}
              </CompactBadge>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <DetailLine label="Total ventas" value={Number(effectiveClosure?.expected_sales_total ?? 0)} />
              <DetailLine label="Otros medios" value={digitalTotal} />
              <DetailLine label="Cuenta corriente" value={Number(effectiveClosure?.expected_account_sales_total ?? 0)} />
              <DetailLine label="Gastos no efectivo" value={Number(effectiveClosure?.expected_account_expenses_total ?? 0)} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/40 p-4 text-sm leading-7 text-muted-foreground">
              El conteo fisico del efectivo se completa sobre el resumen impreso. Desde esta pantalla cerras la caja del sistema y dejas observaciones.
            </div>
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

          <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/42 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Detalle de control</h3>
            <div className="mt-4 space-y-3 text-sm">
              <DetailLine label="Efectivo remito" value={Number(effectiveClosure?.expected_cash_remito_total ?? 0)} />
              <DetailLine label="Efectivo facturable" value={Number(effectiveClosure?.expected_cash_facturable_total ?? 0)} />
              <DetailLine label="Servicios / remito" value={Number(effectiveClosure?.expected_services_remito_total ?? 0)} />
              <DetailLine label="Point esperado" value={Number(effectiveClosure?.expected_point_sales_total ?? 0)} />
              <DetailLine label="Transferencias esperadas" value={Number(effectiveClosure?.expected_transfer_sales_total ?? 0)} />
              <div className="border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground">
                  Estado del cierre: {effectiveClosure?.status === "CERRADO"
                    ? `cerrado el ${formatDateTime(effectiveClosure.closed_at ?? null)}`
                    : "todavia abierto"}
                </p>
              </div>
            </div>
          </div>
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
          {effectiveClosure?.status === "CERRADO" ? <p className="text-sm text-muted-foreground">El cierre ya esta bloqueado. Solo queda disponible para consulta.</p> : null}
          {!canCloseCash ? <p className="text-sm text-muted-foreground">Solo administracion puede cerrar o modificar el cierre diario.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
