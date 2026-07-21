import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/common/EntityDialog";
import { formatBusinessDate, formatDateTime } from "@/lib/formatters";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { CashClosureSalesTable } from "@/features/cash/components/CashClosureSalesTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { AmountDisplay, StatusBadge } from "@/components/common/VisualSystem";
import type { CashClosureHistoryRow, CashMovementRow } from "@/features/cash/types";

type CashClosurePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClosurePreview: CashClosureHistoryRow | null;
  selectedClosureMovements: CashMovementRow[];
  onPrint: () => void;
};

export function CashClosurePreviewDialog({
  open,
  onOpenChange,
  selectedClosurePreview,
  selectedClosureMovements,
  onPrint,
}: CashClosurePreviewDialogProps) {
  const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  useEffect(() => {
    setPage(1);
  }, [selectedClosurePreview?.id, pageSize]);

  const salesPagination = usePaginationSlice({
    items: selectedClosureMovements,
    page,
    pageSize,
  });

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
          <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-[hsl(var(--panel))]/30 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Historial de caja</p>
                <h3 className="mt-1 text-2xl font-black text-foreground">
                  {formatBusinessDate(selectedClosurePreview.business_date)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedClosurePreview.status === "CERRADO"
                    ? `Cerrado el ${formatDateTime(selectedClosurePreview.closed_at)}`
                    : "Caja abierta"}
                </p>
              </div>
              <StatusBadge tone={selectedClosurePreview.status === "CERRADO" ? "success" : "warning"}>
                {selectedClosurePreview.status === "CERRADO" ? "Cerrado" : "Abierto"}
              </StatusBadge>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-2xl border border-success/18 bg-success/10 p-4">
                <p className="text-xs font-medium text-muted-foreground">Efectivo a rendir</p>
                <AmountDisplay value={Number(selectedClosurePreview.expected_cash_to_render)} size="hero" className="mt-2 text-success" />
                <p className="mt-2 text-sm text-muted-foreground">Movimientos incluidos: {selectedClosureMovements.length}</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/76 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Total ventas</p>
                    <AmountDisplay value={Number(selectedClosurePreview.expected_sales_total)} size="sm" className="mt-1" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gastos efectivo</p>
                    <AmountDisplay value={Number(selectedClosurePreview.expected_cash_expenses_total)} size="sm" className="mt-1 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Point</p>
                    <AmountDisplay value={Number(selectedClosurePreview.expected_point_sales_total)} size="sm" className="mt-1" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transferencias</p>
                    <AmountDisplay value={Number(selectedClosurePreview.expected_transfer_sales_total)} size="sm" className="mt-1" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cuenta corriente</p>
                    <AmountDisplay value={Number(selectedClosurePreview.expected_account_sales_total)} size="sm" className="mt-1" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gastos fuera de caja</p>
                    <AmountDisplay value={Number(selectedClosurePreview.expected_account_expenses_total)} size="sm" className="mt-1" />
                  </div>
                </div>
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
            <CashClosureSalesTable movements={salesPagination.pagedItems} />
            {selectedClosureMovements.length > 0 ? (
              <div className="border-t border-border/60 px-4 py-3">
                <DataTablePagination
                  page={salesPagination.page}
                  totalPages={salesPagination.totalPages}
                  totalItems={selectedClosureMovements.length}
                  rangeStart={salesPagination.rangeStart}
                  rangeEnd={salesPagination.rangeEnd}
                  pageSize={pageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="movimientos"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </EntityDialog>
  );
}
