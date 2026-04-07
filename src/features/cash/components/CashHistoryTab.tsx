import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, formatBusinessDate, formatDateTime } from "@/lib/formatters";
import type { CashClosureHistoryRow } from "../types";

type CashHistoryTabProps = {
  closuresHistory: CashClosureHistoryRow[];
  onOpenSummary: (closureId: string) => void;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  pageSize: number;
};

export function CashHistoryTab({
  closuresHistory,
  onOpenSummary,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  pageSize,
}: CashHistoryTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Historial de cierres</CardTitle>
          <CardDescription>Resúmenes diarios guardados para consulta e impresión.</CardDescription>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          {closuresHistory.length} registro{closuresHistory.length === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {closuresHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Todavía no hay cierres guardados.</div>
          ) : (
            closuresHistory.map((historyItem) => (
              <div key={historyItem.id} className="flex flex-col gap-3 rounded-2xl border border-border/55 bg-background/68 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{formatBusinessDate(historyItem.business_date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {historyItem.status === "CERRADO" ? `Cerrado el ${formatDateTime(historyItem.closed_at)}` : "Caja abierta"}
                  </p>
                </div>
                <div className="grid gap-2 text-sm md:grid-cols-3 md:text-right">
                  <div>
                    <p className="text-muted-foreground">Ventas</p>
                    <p className="font-semibold">{currency.format(Number(historyItem.expected_sales_total))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Efectivo</p>
                    <p className="font-semibold">{currency.format(Number(historyItem.expected_cash_to_render))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado</p>
                    <p className="font-semibold">{historyItem.status === "CERRADO" ? "Cerrado" : "Abierto"}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => onOpenSummary(historyItem.id)}>
                  Ver resumen
                </Button>
              </div>
            ))
          )}
        </div>
        {closuresHistory.length > 0 ? (
          <div className="mt-5 flex items-center justify-between border-t border-border/45 pt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {(page - 1) * pageSize + 1}-{(page - 1) * pageSize + closuresHistory.length}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onPrevPage} disabled={page <= 1}>
                Anterior
              </Button>
              <span className="min-w-24 text-center text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <Button type="button" variant="outline" size="sm" onClick={onNextPage} disabled={page >= totalPages}>
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
