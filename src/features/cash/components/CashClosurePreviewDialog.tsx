import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, formatBusinessDate, formatDateTime, formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL, RECEIPT_LABEL } from "../constants";
import type { CashClosureHistoryRow, CashSaleRow } from "../types";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Resumen del cierre</DialogTitle>
          <DialogDescription>Vista previa del cierre diario guardado para control e impresion.</DialogDescription>
        </DialogHeader>
        {selectedClosurePreview ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
            <div className="rounded-3xl border bg-gradient-to-br from-white via-white to-sky-50 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cierre diario</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-950">{formatBusinessDate(selectedClosurePreview.business_date)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedClosurePreview.status === "CERRADO" ? `Cerrado el ${formatDateTime(selectedClosurePreview.closed_at)}` : "Caja abierta"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Estado</p>
                  <p className="mt-1 text-lg font-bold">{selectedClosurePreview.status === "CERRADO" ? "Cerrado" : "Abierto"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border bg-white/95 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total ventas</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">{currency.format(Number(selectedClosurePreview.expected_sales_total))}</p>
                  <p className="text-sm text-muted-foreground">Movimientos: {selectedClosureSales.length}</p>
                </div>
                <div className="rounded-2xl border bg-emerald-50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo esperado</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700">{currency.format(Number(selectedClosurePreview.expected_cash_to_render))}</p>
                </div>
                <div className="rounded-2xl border bg-sky-50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Point esperado</p>
                  <p className="mt-2 text-xl font-bold text-sky-700">{currency.format(Number(selectedClosurePreview.expected_point_sales_total))}</p>
                </div>
                <div className="rounded-2xl border bg-violet-50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Transf. esperadas</p>
                  <p className="mt-2 text-xl font-bold text-violet-700">{currency.format(Number(selectedClosurePreview.expected_transfer_sales_total))}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border bg-white/95 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo real</p>
                  <div className="mt-3 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-50/70" />
                  <p className="mt-2 text-sm text-muted-foreground">Completa responsable de caja.</p>
                </div>
                <div className="rounded-2xl border bg-amber-50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Diferencia</p>
                  <div className="mt-3 h-14 rounded-xl border border-dashed border-amber-300 bg-amber-50/80" />
                  <p className="mt-2 text-sm text-muted-foreground">Se completa a mano al momento del control.</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-dashed bg-white/90 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedClosurePreview.notes ?? "Sin observaciones"}</p>
              </div>
            </div>

            <div className="rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedClosureSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatTime(sale.sold_at)}</TableCell>
                      <TableCell>{sale.customer_name_snapshot ?? "Consumidor final"}</TableCell>
                      <TableCell>{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                      <TableCell>{sale.receipt_reference ?? RECEIPT_LABEL[sale.receipt_kind]}</TableCell>
                      <TableCell className="text-right font-semibold">{currency.format(Number(sale.amount_total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
        <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-white px-6 pb-6 pt-4 sm:justify-end">
          <Button variant="outline" onClick={onPrint}>Imprimir</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
