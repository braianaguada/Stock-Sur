import { CheckCircle2, Clock, FileText, LucideIcon, PlayCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import type { CompanySettings } from "@/contexts/company-brand-context";
import { CUSTOMER_KIND_LABEL, DOC_LABEL, DOC_TYPE_CLASS, STATUS_LABEL } from "@/features/documents/constants";
import type { DocEventRow, DocLineRow, DocRow } from "@/features/documents/types";
import { describeDocumentHistoryEvent, formatNumber } from "@/features/documents/utils";
import { formatIsoDate, formatTimestampDate, formatTimestampTime } from "@/lib/formatters";

interface DocumentsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocument: DocRow | null;
  selectedLines: DocLineRow[];
  selectedEvents: DocEventRow[];
  sourceDocumentLabel: string | null;
  companySettings: CompanySettings;
  isExternalInvoiceLocked: boolean;
  onSetExternalInvoice: (documentId: string, externalInvoiceNumber: string) => void;
  onClearExternalInvoice: (documentId: string) => void;
  isUpdatingExternalInvoice: boolean;
}

const HISTORY_TONE_COLORS: Record<string, { bg: string; border: string; text: string; icon: LucideIcon }> = {
  neutral: { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700", icon: PlayCircle },
  success: { bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-700", icon: CheckCircle2 },
  warning: { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-700", icon: Clock },
  danger: { bg: "bg-rose-100", border: "border-rose-200", text: "text-rose-700", icon: XCircle },
};

export function DocumentsPreviewDialog(props: DocumentsPreviewDialogProps) {
  const {
    open,
    onOpenChange,
    selectedDocument,
    selectedLines,
    selectedEvents,
    sourceDocumentLabel,
    companySettings,
    isExternalInvoiceLocked,
    onSetExternalInvoice,
    onClearExternalInvoice,
    isUpdatingExternalInvoice,
  } = props;
  const handleSetExternalInvoice = () => {
    if (!selectedDocument) return;
    const currentValue = selectedDocument.external_invoice_number ?? "";
    const nextValue = window.prompt("Numero de factura externa", currentValue)?.trim();
    if (!nextValue) return;
    onSetExternalInvoice(selectedDocument.id, nextValue);
  };

  const handleClearExternalInvoice = () => {
    if (!selectedDocument) return;
    if (!window.confirm("Quieres quitar la factura externa asociada?")) return;
    onClearExternalInvoice(selectedDocument.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col h-[min(92vh,920px)] max-w-[min(97vw,1520px)] overflow-hidden border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">Vista previa del documento</DialogTitle>
        </DialogHeader>

        {selectedDocument ? (
          <div className="grid flex-1 min-h-0 gap-4 2xl:grid-cols-[minmax(0,1.95fr)_minmax(380px,460px)]">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable]">
              <div className="space-y-5">
                <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm">
                  <div className="border-b border-border/60 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <Badge variant="outline" className={DOC_TYPE_CLASS[selectedDocument.doc_type]}>
                          {DOC_LABEL[selectedDocument.doc_type]}
                        </Badge>
                        <div className="space-y-1">
                          {companySettings.logo_url ? (
                            <img src={companySettings.logo_url} alt={companySettings.app_name} className="h-12 w-auto max-w-[220px] object-contain" />
                          ) : (
                            <p className="text-2xl font-semibold tracking-tight text-foreground">{companySettings.app_name}</p>
                          )}
                          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            {companySettings.document_tagline ?? "Documentacion comercial"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-foreground/60">Documento</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{DOC_LABEL[selectedDocument.doc_type]}</p>
                        <p className="mt-2 font-mono text-sm text-foreground/80">
                          {formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}
                        </p>
                      </div>
                    </div>

                    {sourceDocumentLabel ? (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-foreground/60">Origen</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{sourceDocumentLabel}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="border-b border-border/60 px-5 py-5 lg:border-b-0 lg:border-r sm:px-6">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cliente</p>
                      <p className="mt-2 text-xl font-semibold text-foreground">{selectedDocument.customer_name ?? "Cliente ocasional"}</p>
                      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <p>Tipo: <span className="font-medium text-foreground">{CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]}</span></p>
                        <p>CUIT: <span className="font-mono">{selectedDocument.customer_tax_id ?? "-"}</span></p>
                        <p>Cond. fiscal: <span className="font-medium text-foreground">{selectedDocument.customer_tax_condition ?? "-"}</span></p>
                        <p>PDV: <span className="font-mono text-foreground">{String(selectedDocument.point_of_sale).padStart(4, "0")}</span></p>
                        <p>Fecha: <span className="font-medium text-foreground">{formatIsoDate(selectedDocument.issue_date)}</span></p>
                        <p>Estado: <span className="font-medium text-foreground">{STATUS_LABEL[selectedDocument.status]}</span></p>
                      </div>
                    </div>

                    <div className="px-5 py-5 sm:px-6">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operación</p>
                      <div className="mt-4 space-y-2 text-sm">
                        {selectedDocument.payment_terms ? <p className="text-muted-foreground">Condición: <span className="text-foreground">{selectedDocument.payment_terms}</span></p> : null}
                        {selectedDocument.salesperson ? <p className="text-muted-foreground">Vendedor: <span className="text-foreground">{selectedDocument.salesperson}</span></p> : null}
                        {selectedDocument.valid_until ? <p className="text-muted-foreground">Validez: <span className="text-foreground">{formatIsoDate(selectedDocument.valid_until)}</span></p> : null}
                        {selectedDocument.doc_type === "REMITO" && selectedDocument.external_invoice_number ? <p className="text-muted-foreground">Factura: <span className="font-mono text-foreground">{selectedDocument.external_invoice_number}</span></p> : null}
                        {selectedDocument.delivery_address ? <p className="text-muted-foreground">Entrega: <span className="text-foreground">{selectedDocument.delivery_address}</span></p> : null}
                      </div>

                      {selectedDocument.doc_type === "REMITO" && !isExternalInvoiceLocked ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={handleSetExternalInvoice} disabled={isUpdatingExternalInvoice}>
                            {selectedDocument.external_invoice_number ? "Editar factura externa" : "Registrar factura externa"}
                          </Button>
                          {selectedDocument.external_invoice_number ? (
                            <Button type="button" size="sm" variant="destructive" onClick={handleClearExternalInvoice} disabled={isUpdatingExternalInvoice}>
                              Quitar factura externa
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Items</p>
                      <p className="mt-1 text-sm text-muted-foreground">Detalle principal del documento.</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total del documento</p>
                      <p className="mt-1 text-3xl font-black tracking-tight text-foreground">
                        ${Number(selectedDocument.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {selectedDocument.notes ? (
                    <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Notas</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">{selectedDocument.notes}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-background">
                    <LineItemsTable
                      rows={selectedLines.map((line) => ({
                        id: line.id,
                        line_order: line.line_order,
                        sku: line.sku_snapshot,
                        description: line.description,
                        quantity: line.quantity,
                        unit: line.unit,
                        unit_price: line.unit_price,
                        total: line.line_total,
                      }))}
                      showOrder
                      showSku
                    />
                  </div>
                </section>
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable] 2xl:min-w-[380px]">
              <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Historial</p>
                <p className="mt-1 text-sm text-muted-foreground">Trazabilidad del documento.</p>
                {sourceDocumentLabel ? (
                  <Badge variant="secondary" className="mt-4 px-3 py-1 font-mono text-xs">
                    Origen: {sourceDocumentLabel}
                  </Badge>
                ) : null}

                {selectedEvents.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                    <Clock className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-medium text-muted-foreground">Sin eventos registrados</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {selectedEvents.map((event, index) => {
                      const described = describeDocumentHistoryEvent(event);
                      const toneColors = HISTORY_TONE_COLORS[described.tone] || HISTORY_TONE_COLORS.neutral;
                      const Icon = toneColors.icon;
                      return (
                          <div key={event.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3 rounded-xl border border-border/60 bg-background/80 p-4">
                          <div className="relative flex justify-center">
                            <div className="absolute top-0 bottom-0 w-px bg-border/70" />
                            <div className={`relative mt-1.5 flex h-6 w-6 items-center justify-center rounded-full border ${toneColors.bg} ${toneColors.border}`}>
                              <Icon className={`h-3.5 w-3.5 ${toneColors.text}`} strokeWidth={3} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5 text-foreground">{described.title}</p>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">{described.detail}</p>
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
