import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/common/EntityDialog";
import { currency, formatBusinessDate, formatDateTime } from "@/lib/formatters";
import { CashClosureSalesTable } from "@/features/cash/components/CashClosureSalesTable";
import type { CashClosureHistoryRow, CashSaleRow } from "@/features/cash/types";

type CashClosurePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClosurePreview: CashClosureHistoryRow | null;
  selectedClosureSales: CashSaleRow[];
  onPrint: () => void;
};

export function CashClosurePreviewDialog({
  open,
  onOpenChange,
  selectedClosurePreview,
  selectedClosureSales,
  onPrint,
}: CashClosurePreviewDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Resumen del cierre"
      description="Vista previa del cierre diario guardado para control e impresion."
      contentClassName="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden"
      footer={(
        <>
          <Button variant="outline" onClick={onPrint}>Imprimir</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </>
      )}
    >
      {selectedClosurePreview ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-[hsl(var(--panel))]/36 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cierre diario</p>
                <h3 className="mt-2 text-2xl font-black text-foreground">
                  {formatBusinessDate(selectedClosurePreview.business_date)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedClosurePreview.status === "CERRADO"
                    ? `Cerrado el ${formatDateTime(selectedClosurePreview.closed_at)}`
                    : "Caja abierta"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/82 px-4 py-3 text-right shadow-[var(--shadow-xs)]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Estado</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {selectedClosurePreview.status === "CERRADO" ? "Cerrado" : "Abierto"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total ventas</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-foreground [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_sales_total))}
                </p>
                <p className="text-sm text-muted-foreground">Movimientos: {selectedClosureSales.length}</p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-success/18 bg-success/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo a rendir</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-success [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_cash_to_render))}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-lime-500/18 bg-lime-500/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo remito</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-lime-600 dark:text-lime-400 [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_cash_remito_total))}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-warning/18 bg-warning/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo facturable</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-warning [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_cash_facturable_total))}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-amber-400/18 bg-amber-400/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Servicios / remito</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-amber-600 dark:text-amber-400 [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_services_remito_total))}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-info/18 bg-info/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Point esperado</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-info [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_point_sales_total))}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-primary/18 bg-primary/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Transf. esperadas</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-primary [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_transfer_sales_total))}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-500/18 bg-slate-500/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cuenta corriente</p>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[1.1rem] font-bold text-slate-700 dark:text-slate-300 [font-variant-numeric:tabular-nums]">
                  {currency.format(Number(selectedClosurePreview.expected_account_sales_total))}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo real</p>
                <div className="mt-3 h-14 rounded-xl border border-dashed border-border/80 bg-[hsl(var(--panel))]/40" />
                <p className="mt-2 text-sm text-muted-foreground">Completa responsable de caja.</p>
              </div>
              <div className="rounded-2xl border border-warning/18 bg-warning/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Diferencia</p>
                <div className="mt-3 h-14 rounded-xl border border-dashed border-warning/30 bg-warning/8" />
                <p className="mt-2 text-sm text-muted-foreground">Se completa a mano al momento del control.</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-dashed border-border/70 bg-background/72 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedClosurePreview.notes ?? "Sin observaciones"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/72 overflow-auto">
            <CashClosureSalesTable sales={selectedClosureSales} />
          </div>
        </div>
      ) : null}
    </EntityDialog>
  );
}
