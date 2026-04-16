import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currency, formatDocumentNumber } from "@/lib/formatters";
import { DOC_STATUS_LABEL, PAYMENT_LABEL, RECEIPT_LABEL } from "../constants";
import type { CashSaleRow, DocumentEventQuickRow, DocumentLineQuickRow, DocumentQuickRow } from "../types";
import { describeDocumentEvent } from "../utils";

type CashDocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailSale: CashSaleRow | null;
  linkedDocument: DocumentQuickRow | null;
  linkedDocumentLines: DocumentLineQuickRow[];
  linkedDocumentEvents: DocumentEventQuickRow[];
  companyBrand: {
    appName: string;
    logoUrl: string | null;
    documentTagline: string | null;
  };
  canAttachReceipt: (sale: CashSaleRow) => boolean;
  canCancelSale: (sale: CashSaleRow) => boolean;
  onAssignReceipt: (sale: CashSaleRow) => void;
  onCancelSale: (saleId: string) => void;
  cancelPending: boolean;
};

export function CashDocumentPreviewDialog({
  open,
  onOpenChange,
  detailSale,
  linkedDocument,
  linkedDocumentLines,
  linkedDocumentEvents,
  companyBrand,
  canAttachReceipt,
  canCancelSale,
  onAssignReceipt,
  onCancelSale,
  cancelPending,
}: CashDocumentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Vista previa del documento</DialogTitle>
          <DialogDescription>Documento asociado a la venta y su trazabilidad.</DialogDescription>
        </DialogHeader>
        {detailSale ? (
          <div className="grid gap-3 rounded-3xl border bg-slate-50 p-4 md:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
              <p className="mt-1 font-semibold">{detailSale.customer_name_snapshot ?? "Consumidor final"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pago</p>
              <p className="mt-1 font-semibold">{PAYMENT_LABEL[detailSale.payment_method]}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Comprobante</p>
              <p className="mt-1 font-semibold">{detailSale.receipt_reference ?? RECEIPT_LABEL[detailSale.receipt_kind]}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Importe</p>
              <p className="mt-1 font-semibold">{currency.format(Number(detailSale.amount_total))}</p>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {linkedDocument ? (
            <>
              <div className="min-w-0 max-h-[72vh] space-y-4 overflow-y-auto pr-1">
                <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50 p-5 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Remito</Badge>
                        <div>
                          {companyBrand.logoUrl ? (
                            <img src={companyBrand.logoUrl} alt={companyBrand.appName} className="h-16 w-auto max-w-[220px] object-contain" />
                          ) : (
                            <p className="text-2xl font-black tracking-[0.12em] text-primary">{companyBrand.appName}</p>
                          )}
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {companyBrand.documentTagline ?? "Documentacion comercial"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Documento</p>
                        <p className="mt-1 text-lg font-bold">{linkedDocument.doc_type === "REMITO" ? "Remito" : linkedDocument.doc_type}</p>
                        <p className="mt-2 text-xs text-slate-300">{formatDocumentNumber(linkedDocument.point_of_sale, linkedDocument.document_number)}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/95 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Cliente</p>
                        <p className="mt-2 font-semibold">{linkedDocument.customer_name ?? "Cliente ocasional"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/95 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Operacion</p>
                        <p className="mt-2 text-sm"><span className="font-semibold">Fecha:</span> {new Date(linkedDocument.issue_date).toLocaleDateString("es-AR")}</p>
                        <p className="text-sm"><span className="font-semibold">Estado:</span> {DOC_STATUS_LABEL[linkedDocument.status]}</p>
                        <p className="text-sm"><span className="font-semibold">Punto de venta:</span> {String(linkedDocument.point_of_sale).padStart(4, "0")}</p>
                        {linkedDocument.external_invoice_number ? (
                          <p className="text-sm"><span className="font-semibold">Factura externa:</span> {linkedDocument.external_invoice_number}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border bg-card p-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resumen</p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border bg-emerald-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total documento</p>
                        <p className="mt-2 text-3xl font-black text-primary">{currency.format(Number(linkedDocument.total))}</p>
                      </div>
                      <div className="rounded-2xl border border-dashed p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                        <p className="mt-2 text-sm text-muted-foreground">{linkedDocument.notes ?? "Sin observaciones cargadas."}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border">
                  <LineItemsTable
                    rows={linkedDocumentLines.map((line) => ({
                      id: line.id,
                      line_order: line.line_order,
                      description: line.description,
                      quantity: line.quantity,
                      unit: line.unit,
                      unit_price: line.unit_price,
                      total: line.line_total,
                    }))}
                    showOrder
                    currencyFormatter={(value) => currency.format(Number(value))}
                  />
                </div>
              </div>

              <aside className="rounded-3xl border bg-card p-5 lg:max-h-[72vh] lg:overflow-y-auto">
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Historial</p>
                  <p className="mt-1 text-sm text-muted-foreground">Linea de tiempo del documento.</p>
                </div>

                {linkedDocumentEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    Todavia no hay eventos registrados para este documento.
                  </div>
                ) : (
                  <div className="relative pl-7">
                    <div className="absolute bottom-2 left-[11px] top-2 w-px rounded-full bg-gradient-to-b from-blue-200 via-emerald-200 to-slate-200" />
                    <div className="space-y-4">
                      {linkedDocumentEvents.map((event) => {
                        const described = describeDocumentEvent(event);
                        return (
                          <div key={event.id} className="relative">
                            <div className={`absolute left-[-21px] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-white shadow-md ${described.tone === "success" ? "bg-emerald-500" : described.tone === "danger" ? "bg-rose-500" : described.tone === "info" ? "bg-blue-500" : "bg-slate-400"}`} />
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-5 text-slate-900">{described.title}</p>
                                  <p className="mt-1 text-sm leading-5 text-slate-500">{event.event_type.replaceAll("_", " ")}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <Badge variant="outline">{new Date(event.created_at).toLocaleDateString("es-AR")}</Badge>
                                  <p className="mt-2 text-xs text-slate-400">
                                    {new Date(event.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </aside>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              Esta venta no tiene un documento interno para previsualizar. Si fue facturada por afuera del sistema, arriba queda visible la referencia cargada.
            </div>
          )}
        </div>
        <DialogFooter>
          {detailSale && canAttachReceipt(detailSale) ? (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onAssignReceipt(detailSale);
              }}
            >
              Asignar comprobante
            </Button>
          ) : null}
          {detailSale && detailSale.status !== "ANULADA" ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => onCancelSale(detailSale.id)}
              disabled={cancelPending || !canCancelSale(detailSale)}
            >
              Anular
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
