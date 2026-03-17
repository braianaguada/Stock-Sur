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
};

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
}: CashClosureTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Cierre diario</CardTitle>
          <CardDescription>Cierre operativo del dia con los totales esperados y el resumen imprimible para control.</CardDescription>
        </div>
        <Badge variant="outline" className={effectiveClosure?.status === "CERRADO" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
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
          <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Efectivo a rendir</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_cash_to_render ?? 0))}</CardTitle></CardHeader></Card>
          <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Point esperado</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_point_sales_total ?? 0))}</CardTitle></CardHeader></Card>
          <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Transferencias esperadas</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_transfer_sales_total ?? 0))}</CardTitle></CardHeader></Card>
          <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Total ventas</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_sales_total ?? 0))}</CardTitle></CardHeader></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              El conteo fisico del efectivo se completa sobre el resumen impreso. Desde esta pantalla solo cerras la caja del sistema y dejas observaciones.
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-notes">Observaciones del cierre</Label>
              <Textarea
                id="close-notes"
                rows={5}
                value={closeNotes}
                onChange={(event) => onCloseNotesChange(event.target.value)}
                disabled={effectiveClosure?.status === "CERRADO"}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resumen operativo</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Efectivo esperado</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_cash_to_render ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total ventas</span>
                <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_sales_total ?? 0))}</span>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">Estado del cierre: {effectiveClosure?.status === "CERRADO" ? `cerrado el ${formatDateTime(effectiveClosure.closed_at ?? null)}` : "todavia abierto"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onCloseClosure} disabled={closureLoading || closePending || effectiveClosure?.status === "CERRADO" || Boolean(closureError)}>
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
        </div>
      </CardContent>
    </Card>
  );
}
