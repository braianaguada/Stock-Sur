import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, formatBusinessDate, formatDateTime } from "@/lib/formatters";
import type { CashClosureHistoryRow } from "../types";

type CashHistoryTabProps = {
  closuresHistory: CashClosureHistoryRow[];
  onOpenSummary: (closureId: string) => void;
};

export function CashHistoryTab({ closuresHistory, onOpenSummary }: CashHistoryTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Historial de cierres</CardTitle>
          <CardDescription>Resumenes diarios guardados para consulta e impresion.</CardDescription>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          {closuresHistory.length} registro{closuresHistory.length === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {closuresHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Todavia no hay cierres guardados.</div>
          ) : (
            closuresHistory.map((historyItem) => (
              <div key={historyItem.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
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
      </CardContent>
    </Card>
  );
}
