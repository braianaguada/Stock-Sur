import { Ban, ClipboardCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL } from "../constants";
import type { CashSaleRow } from "../types";

type CashPendingTabProps = {
  pendingSales: CashSaleRow[];
  onAssignReceipt: (sale: CashSaleRow) => void;
  onCancelSale: (saleId: string) => void;
  onOpenDetail: (sale: CashSaleRow) => void;
  canAttachReceipt: (sale: CashSaleRow) => boolean;
  canCancelSale: (sale: CashSaleRow) => boolean;
  cancelPending: boolean;
};

export function CashPendingTab({
  pendingSales,
  onAssignReceipt,
  onCancelSale,
  onOpenDetail,
  canAttachReceipt,
  canCancelSale,
  cancelPending,
}: CashPendingTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Pendientes de comprobante</CardTitle>
        <CardDescription>Ventas registradas que ya impactan en caja pero todavía no tienen remito o factura asignada.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[560px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="w-[220px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingSales.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No hay pendientes para esta fecha.</TableCell></TableRow>
              ) : (
                pendingSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs">{formatTime(sale.sold_at)}</TableCell>
                    <TableCell>{sale.customer_name_snapshot ?? "Consumidor final"}</TableCell>
                    <TableCell>{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                    <TableCell className="text-right font-semibold">{currency.format(Number(sale.amount_total))}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="icon" variant="outline" onClick={() => onAssignReceipt(sale)} disabled={!canAttachReceipt(sale)}>
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onCancelSale(sale.id)}
                          disabled={cancelPending || !canCancelSale(sale)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => onOpenDetail(sale)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
