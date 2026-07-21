import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBusinessDate, formatDateTime } from "@/lib/formatters";
import { AmountDisplay, CountBadge, StatusBadge } from "@/components/common/VisualSystem";
import type { CashClosureHistoryRow } from "../types";

type CashHistoryTabProps = {
  closuresHistory: CashClosureHistoryRow[];
  totalItems: number;
  onOpenSummary: (closureId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (pageSize: number) => void;
};

export function CashHistoryTab({
  closuresHistory,
  totalItems,
  onOpenSummary,
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: CashHistoryTabProps) {
  const fillerItems = Math.max(0, pageSize - closuresHistory.length);
  const historyRowClassName =
    "min-h-[108px] rounded-2xl border border-border/55 bg-background/72 p-4";

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Historial de cierres</CardTitle>
          <CardDescription>Resumenes diarios guardados para consulta e impresion.</CardDescription>
        </div>
        <CountBadge>
          {totalItems} registro{totalItems === 1 ? "" : "s"}
        </CountBadge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {closuresHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Todavia no hay cierres guardados.
            </div>
          ) : (
            closuresHistory.map((historyItem) => (
              <div
                key={historyItem.id}
                className={historyRowClassName}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{formatBusinessDate(historyItem.business_date)}</p>
                      <StatusBadge tone={historyItem.status === "CERRADO" ? "success" : "warning"}>
                        {historyItem.status === "CERRADO" ? "Cerrado" : "Abierto"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {historyItem.status === "CERRADO"
                        ? `Cerrado el ${formatDateTime(historyItem.closed_at)}`
                        : "Pendiente de cierre"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total ventas</p>
                      <AmountDisplay value={Number(historyItem.expected_sales_total)} size="sm" className="mt-1" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Efectivo</p>
                      <AmountDisplay value={Number(historyItem.expected_cash_to_render)} size="sm" className="mt-1 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gastos</p>
                      <AmountDisplay value={Number(historyItem.expected_cash_expenses_total)} size="sm" className="mt-1 text-destructive" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Otros medios</p>
                      <AmountDisplay
                        value={
                          Number(historyItem.expected_point_sales_total) +
                          Number(historyItem.expected_transfer_sales_total) +
                          Number(historyItem.expected_services_remito_total)
                        }
                        size="sm"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex xl:justify-end">
                    <Button variant="outline" onClick={() => onOpenSummary(historyItem.id)}>
                      Ver resumen
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          {closuresHistory.length > 0
            ? Array.from({ length: fillerItems }).map((_, index) => (
                <div
                  key={`closure-filler-${index}`}
                  aria-hidden="true"
                  className={`${historyRowClassName} invisible`}
                />
              ))
            : null}
        </div>
        {closuresHistory.length > 0 ? (
          <div className="mt-5 border-t border-border/45 pt-4">
            <DataTablePagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              rangeStart={totalItems === 0 ? 0 : (page - 1) * pageSize + 1}
              rangeEnd={totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems)}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              itemLabel="cierres"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
