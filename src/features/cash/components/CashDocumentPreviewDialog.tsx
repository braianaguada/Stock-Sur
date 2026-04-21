import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currency, formatDocumentNumber, formatIsoDate, formatTimestampDate, formatTimestampTime } from "@/lib/formatters";
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
      <DialogContent className="max-w-[min(96vw,1460px)] max-h-[92vh] overflow-hidden border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">Vista previa del documento</DialogTitle>
          <DialogDescription>Documento asociado a la venta y su trazabilidad.</DialogDescription>
        </DialogHeader>

        {detailSale ? (
          <div className="grid gap-4 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm md:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p><p className="mt-1 font-semibold">{detailSale.customer_name_snapshot ?? "Consumidor final"}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pago</p><p className="mt-1 font-semibold">{PAYMENT_LABEL[detailSale.payment_method]}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Comprobante</p><p className="mt-1 font-semibold">{detailSale.receipt_reference ?? RECEIPT_LABEL[detailSale.receipt_kind]}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Importe</p><p className="mt-1 font-semibold">{currency.format(Number(detailSale.amount_total))}</p></div>
          </div>
        ) : null}

        <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,420px)]">
          {linkedDocument ? (
            <>
              <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable]">
                <div className="space-y-5">
                  <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 space-y-3">
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Remito</Badge>
                        <div className="space-y-1">
                          {companyBrand.logoUrl ? (
                            <img src={companyBrand.logoUrl} alt={companyBrand.appName} className="h-12 w-auto max-w-[220px] object-contain" />
                          ) : (
                            <p className="text-2xl font-semibold tracking-tight">{companyBrand.appName}</p>
                          )}
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                            {companyBrand.documentTagline ?? "Documentacion comercial"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-white shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Documento</p>
                        <p className="mt-1 text-lg font-semibold">{linkedDocument.doc_type === "REMITO" ? "Remito" : linkedDocument.doc_type}</p>
                        <p className="mt-2 font-mono text-sm text-slate-300">
                          {formatDocumentNumber(linkedDocument.point_of_sale, linkedDocument.document_number)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cliente</p>
                        <p className="mt-2 text-lg font-semibold">{linkedDocument.customer_name ?? "Cliente ocasional"}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Operación</p>
                        <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] gap-y-2 text-sm text-muted-foreground">
                          <p>Fecha:</p>
                          <p className="font-medium text-foreground">{formatIsoDate(linkedDocument.issue_date)}</p>
                          <p>Estado:</p>
                          <p className="font-medium text-foreground">{DOC_STATUS_LABEL[linkedDocument.status]}</p>
                          <p>Punto de venta:</p>
                          <p className="font-mono text-foreground">{String(linkedDocument.point_of_sale).padStart(4, "0")}</p>
                          {linkedDocument.external_invoice_number ? (
                            <>
                              <p>Factura externa:</p>
                              <p className="font-mono font-medium text-foreground">{linkedDocument.external_invoice_number}</p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Resumen económico</p>
                        <p className="mt-1 text-sm text-muted-foreground">Importe, notas y detalle.</p>
                      </div>
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total documento</p>
                        <p className="mt-1 text-3xl font-black tracking-tight text-primary">{currency.format(Number(linkedDocument.total))}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Notas</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">
                        {linkedDocument.notes ?? "Sin observaciones cargadas."}
                      </p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-white shadow-sm">
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
                  </section>
                </div>
              </div>

              <aside className="min-h-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable] xl:min-w-[360px]">
                <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Historial de eventos</p>
                  <p className="mt-1 text-sm text-muted-foreground">Línea de tiempo del documento.</p>

                  {linkedDocumentEvents.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                      <p className="text-sm font-medium text-muted-foreground">Todavía no hay eventos registrados para este documento.</p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {linkedDocumentEvents.map((event, index) => {
                        const described = describeDocumentEvent(event);
                        const toneClass =
                          described.tone === "success"
                            ? "bg-emerald-500"
                            : described.tone === "danger"
                              ? "bg-rose-500"
                              : described.tone === "info"
                                ? "bg-blue-500"
                                : "bg-slate-400";

                        return (
                          <div key={event.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                            <div className="relative flex justify-center">
                              <div className="absolute top-0 bottom-0 w-px bg-border/70" />
                              <div className={`relative mt-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background shadow-md ${toneClass}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-5 text-foreground">{described.title}</p>
                                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{event.event_type.replaceAll("_", " ")}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <Badge variant="outline" className="border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
                                    {formatTimestampDate(event.created_at)}
                                  </Badge>
                                  <p className="mt-2 text-xs font-mono text-muted-foreground">{formatTimestampTime(event.created_at)}</p>
                                </div>
                              </div>
                              {index === 0 ? (
                                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-semibold">Más reciente</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </aside>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
              {detailSale?.status === "ANULADA"
                ? "Venta anulada: no hay documento asociado visible."
                : "No hay documento interno para previsualizar. Si fue facturada por afuera del sistema, arriba queda visible la referencia cargada."}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {detailSale && canAttachReceipt(detailSale) ? (
            <Button
              variant="default"
              className="shadow-sm"
              onClick={() => {
                onOpenChange(false);
                onAssignReceipt(detailSale);
              }}
            >
              Asignar comprobante
            </Button>
          ) : null}
          {detailSale && detailSale.status !== "ANULADA" ? (
            <Button variant="ghost" className="text-destructive" onClick={() => onCancelSale(detailSale.id)} disabled={cancelPending || !canCancelSale(detailSale)}>
              Anular
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
