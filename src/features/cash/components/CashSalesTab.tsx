import { Ban, NotebookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL, RECEIPT_LABEL, STATUS_CLASS, STATUS_LABEL } from "../constants";
import type { CashSaleRow, SituationFilter } from "../types";
import { getClosureSituation } from "../utils";

type CashSalesTabProps = {
  filteredSales: CashSaleRow[];
  salesLoading: boolean;
  situationFilter: SituationFilter;
  onSituationFilterChange: (value: SituationFilter) => void;
  hasClosedClosureForDay: boolean;
  onOpenDetail: (sale: CashSaleRow) => void;
  onCancelSale: (saleId: string) => void;
  canCancelSale: (sale: CashSaleRow) => boolean;
  cancelPending: boolean;
};

export function CashSalesTab({
  filteredSales,
  salesLoading,
  situationFilter,
  onSituationFilterChange,
  hasClosedClosureForDay,
  onOpenDetail,
  onCancelSale,
  canCancelSale,
  cancelPending,
}: CashSalesTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Movimientos del dia</CardTitle>
          <CardDescription>Vista rapida para controlar lo cargado y detectar pendientes antes del cierre.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="w-fit">{filteredSales.length} registros</Badge>
          <Select value={situationFilter} onValueChange={(value) => onSituationFilterChange(value as SituationFilter)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="PENDIENTE_CIERRE">Pendiente de cierre</SelectItem>
              <SelectItem value="EN_CAJA_CERRADA">En caja cerrada</SelectItem>
              <SelectItem value="POST_CIERRE">Venta post cierre</SelectItem>
              <SelectItem value="ANULADA">Anuladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[560px] overflow-y-auto rounded-lg border">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow>
                <TableHead className="w-[78px]">Hora</TableHead>
                <TableHead className="w-[110px] text-right">Importe</TableHead>
                <TableHead className="w-[170px]">Cliente</TableHead>
                <TableHead className="w-[96px]">Pago</TableHead>
                <TableHead className="w-[160px]">Comprobante</TableHead>
                <TableHead className="w-[150px]">Situacion</TableHead>
                <TableHead className="w-[92px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando ventas...</TableCell></TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Todavia no hay ventas registradas para esta fecha.</TableCell></TableRow>
              ) : (
                filteredSales.map((sale) => {
                  const closureSituation = getClosureSituation(sale, hasClosedClosureForDay);

                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{formatTime(sale.sold_at)}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{currency.format(Number(sale.amount_total))}</TableCell>
                      <TableCell>
                        <div className="max-w-[160px]">
                          <p className="truncate text-sm font-medium">{sale.customer_name_snapshot ?? "Consumidor final"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                      <TableCell>
                        <div className="min-w-0 text-sm">
                          <p className="truncate">{RECEIPT_LABEL[sale.receipt_kind]}</p>
                          <Badge variant="outline" className={`${STATUS_CLASS[sale.status]} mt-1 max-w-full`}>
                            {STATUS_LABEL[sale.status]}
                          </Badge>
                          {sale.receipt_reference ? <p className="truncate font-mono text-xs text-muted-foreground">{sale.receipt_reference}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={closureSituation.className}>
                          {closureSituation.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenDetail(sale)}>
                            <NotebookText className="h-4 w-4" />
                          </Button>
                          {sale.status !== "ANULADA" ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => onCancelSale(sale.id)}
                              disabled={cancelPending || !canCancelSale(sale)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
