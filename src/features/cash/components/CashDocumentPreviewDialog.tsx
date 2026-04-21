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

export function CashDocumentPreviewDialog(props: CashDocumentPreviewDialogProps) {
  const { open, onOpenChange, detailSale, linkedDocument, linkedDocumentLines, linkedDocumentEvents, companyBrand, canAttachReceipt, canCancelSale, onAssignReceipt, onCancelSale, cancelPending } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(97vw,1520px)] max-h-[92vh] overflow-hidden border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">Vista previa del documento</DialogTitle>
          <DialogDescription>Documento asociado a la venta y su trazabilidad.</DialogDescription>
        </DialogHeader>

        {detailSale && linkedDocument ? (
          <div className="grid gap-4 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm md:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p><p className="mt-1 font-semibold">{detailSale.customer_name_snapshot ?? "Consumidor final"}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pago</p><p className="mt-1 font-semibold">{PAYMENT_LABEL[detailSale.payment_method]}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Comprobante</p><p className="mt-1 font-semibold">{detailSale.receipt_reference ?? RECEIPT_LABEL[detailSale.receipt_kind]}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Importe</p><p className="mt-1 font-semibold">{currency.format(Number(detailSale.amount_total))}</p></div>
          </div>
        ) : null}

        <div className="grid min-h-0 gap-5 2xl:grid-cols-[minmax(0,1.85fr)_minmax(420px,520px)]">
          {linkedDocument ? (
            <>
              <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable]">
                <div className="space-y-5">
                  <section className="overflow-hidden rounded-[30px] border border-border/60 bg-card/90 shadow-sm">
                    <div className="border-b border-border/60 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Remito</Badge>
                          <div className="space-y-1">
                            {companyBrand.logoUrl ? (
                              <img src={companyBrand.logoUrl} alt={companyBrand.appName} className="h-12 w-auto max-w-[220px] object-contain" />
                            ) : (
                              <p className="text-2xl font-semibold tracking-tight text-foreground">{companyBrand.appName}</p>
                            )}
                            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{companyBrand.documentTagline ?? "Documentacion comercial"}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-foreground/60">Documento</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">Remito</p>
                          <p className="mt-2 font-mono text-sm text-foreground/80">{formatDocumentNumber(linkedDocument.point_of_sale, linkedDocument.document_number)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="border-b border-border/60 px-5 py-5 lg:border-b-0 lg:border-r sm:px-6">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cliente</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">{linkedDocument.customer_name ?? "Cliente ocasional"}</p>
                      </div>
                      <div className="px-5 py-5 sm:px-6">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operación</p>
                        <div className="mt-4 space-y-2 text-sm">
                          <p className="text-muted-foreground">Fecha: <span className="text-foreground">{formatIsoDate(linkedDocument.issue_date)}</span></p>
                          <p className="text-muted-foreground">Estado: <span className="text-foreground">{DOC_STATUS_LABEL[linkedDocument.status]}</span></p>
                          <p className="text-muted-foreground">Punto de venta: <span className="font-mono text-foreground">{String(linkedDocument.point_of_sale).padStart(4, "0")}</span></p>
                          {linkedDocument.external_invoice_number ? <p className="text-muted-foreground">Factura externa: <span className="font-mono text-foreground">{linkedDocument.external_invoice_number}</span></p> : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[30px] border border-border/60 bg-card/90 p-5 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Items</p>
                        <p className="mt-1 text-sm text-muted-foreground">Detalle principal de la venta asociada.</p>
                      </div>
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total documento</p>
                        <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{currency.format(Number(linkedDocument.total))}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Notas</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">{linkedDocument.notes ?? "Sin observaciones cargadas."}</p>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background">
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

              <aside className="min-h-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable] 2xl:min-w-[420px]">
                <section className="rounded-[30px] border border-border/60 bg-card/90 p-5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Historial</p>
                  <p className="mt-1 text-sm text-muted-foreground">Trazabilidad de la venta y del remito.</p>

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
                              {index === 0 ? <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-semibold">Más reciente</p> : null}
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
            <Button variant="default" className="shadow-sm" onClick={() => { onOpenChange(false); onAssignReceipt(detailSale); }}>
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
