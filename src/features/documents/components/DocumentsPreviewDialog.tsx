import { CheckCircle2, Clock, FileText, LucideIcon, PlayCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import type { CompanySettings } from "@/contexts/company-brand-context";
import {
  CUSTOMER_KIND_LABEL,
  DOC_LABEL,
  DOC_TYPE_CLASS,
  STATUS_LABEL,
} from "@/features/documents/constants";
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
  neutral: { bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700", text: "text-slate-600 dark:text-slate-400", icon: PlayCircle },
  success: { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800/50", text: "text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  warning: { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800/50", text: "text-amber-700 dark:text-amber-400", icon: Clock },
  danger: { bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800/50", text: "text-red-700 dark:text-red-400", icon: XCircle },
};

export function DocumentsPreviewDialog({
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
}: DocumentsPreviewDialogProps) {
  const handleSetExternalInvoice = () => {
    if (!selectedDocument) return;
    const currentValue = selectedDocument.external_invoice_number ?? "";
    const nextValue = window.prompt("Numero de factura externa", currentValue)?.trim();
    if (nextValue === undefined || !nextValue) return;
    onSetExternalInvoice(selectedDocument.id, nextValue);
  };

  const handleClearExternalInvoice = () => {
    if (!selectedDocument) return;
    const confirmed = window.confirm("Quieres quitar la factura externa asociada?");
    if (!confirmed) return;
    onClearExternalInvoice(selectedDocument.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1440px)] max-h-[92vh] overflow-hidden border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">Vista previa del documento</DialogTitle>
        </DialogHeader>
        {selectedDocument ? (
          <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,380px)]">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 custom-scrollbar">
              <div className="space-y-5">
                <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white p-6 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.08),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.08),_transparent_32%)]" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                    <span className="select-none whitespace-nowrap text-[clamp(56px,9vw,132px)] font-black tracking-[0.2em] text-slate-900/[0.03] -rotate-45">
                      {DOC_LABEL[selectedDocument.doc_type]}
                    </span>
                  </div>

                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="space-y-4">
                      <Badge variant="outline" className={DOC_TYPE_CLASS[selectedDocument.doc_type]}>
                        {DOC_LABEL[selectedDocument.doc_type]}
                      </Badge>
                      <div>
                        {companySettings.logo_url ? (
                          <img src={companySettings.logo_url} alt={companySettings.app_name} className="h-16 w-auto max-w-[220px] object-contain" />
                        ) : (
                          <p className="text-2xl font-black tracking-[0.08em] text-primary">{companySettings.app_name}</p>
                        )}
                        <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-slate-400 font-medium">
                          {companySettings.document_tagline ?? "Documentacion comercial"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-950 px-5 py-4 text-left text-white shadow-xl ring-1 ring-white/10">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-semibold">Documento</p>
                      <p className="mt-1 text-xl font-extrabold tracking-tight">{DOC_LABEL[selectedDocument.doc_type]}</p>
                      <div className="mt-2 inline-flex rounded-md bg-white/10 px-3 py-1 text-sm font-mono tracking-wider text-slate-300">
                        Nro: {formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}
                      </div>
                    </div>
                  </div>

                  {sourceDocumentLabel ? (
                    <div className="relative z-10 mt-5 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-amber-700">Origen del documento</p>
                      <p className="mt-1 text-sm font-medium">{sourceDocumentLabel}</p>
                    </div>
                  ) : null}

                  <div className="relative z-10 mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 shadow-sm">
                      <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                        <FileText className="h-3 w-3" /> Cliente
                      </p>
                      <p className="text-lg font-bold text-slate-800">{selectedDocument.customer_name ?? "Cliente ocasional"}</p>
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        <p>Tipo: <span className="font-medium text-slate-700">{CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]}</span></p>
                        <p>CUIT: <span className="font-mono">{selectedDocument.customer_tax_id ?? "-"}</span></p>
                        <p>Cond. fiscal: <span className="font-medium text-slate-700">{selectedDocument.customer_tax_condition ?? "-"}</span></p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 shadow-sm">
                      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Operación</p>
                      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 text-sm text-slate-600">
                        <p>Fecha:</p>
                        <p className="font-medium text-slate-800">{formatIsoDate(selectedDocument.issue_date)}</p>
                        <p>Estado:</p>
                        <p className="font-medium text-slate-800">{STATUS_LABEL[selectedDocument.status]}</p>
                        <p>PDV:</p>
                        <p className="font-mono text-slate-800">{String(selectedDocument.point_of_sale).padStart(4, "0")}</p>
                        {selectedDocument.payment_terms ? (
                          <>
                            <p>Condición:</p>
                            <p className="font-medium text-slate-800">{selectedDocument.payment_terms}</p>
                          </>
                        ) : null}
                        {selectedDocument.doc_type === "REMITO" && selectedDocument.external_invoice_number ? (
                          <>
                            <p>Factura:</p>
                            <p className="font-mono font-medium text-slate-800">{selectedDocument.external_invoice_number}</p>
                          </>
                        ) : null}
                        {selectedDocument.salesperson ? (
                          <>
                            <p>Vendedor:</p>
                            <p className="font-medium text-slate-800">{selectedDocument.salesperson}</p>
                          </>
                        ) : null}
                        {selectedDocument.valid_until ? (
                          <>
                            <p>Validez:</p>
                            <p className="font-medium text-slate-800">{formatIsoDate(selectedDocument.valid_until)}</p>
                          </>
                        ) : null}
                        {selectedDocument.delivery_address ? (
                          <>
                            <p className="col-span-2 mt-2 pt-2 border-t border-slate-200">Entrega:</p>
                            <p className="col-span-2 font-medium text-slate-800">{selectedDocument.delivery_address}</p>
                          </>
                        ) : null}
                      </div>
                      {selectedDocument.doc_type === "REMITO" ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="shadow-sm"
                            onClick={handleSetExternalInvoice}
                            disabled={isUpdatingExternalInvoice || isExternalInvoiceLocked}
                          >
                            {selectedDocument.external_invoice_number ? "Editar factura externa" : "Registrar factura externa"}
                          </Button>
                          {selectedDocument.external_invoice_number ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="shadow-sm"
                              onClick={handleClearExternalInvoice}
                              disabled={isUpdatingExternalInvoice || isExternalInvoiceLocked}
                            >
                              Quitar factura externa
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative z-10 mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-black/[0.02]">
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

            <aside className="min-h-0 overflow-y-auto pr-1 pb-2 custom-scrollbar">
              <div className="space-y-5">
                <section className="rounded-3xl border border-border/50 bg-card/50 p-5 shadow-sm backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Resumen económico</p>
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-foreground/60">Total del documento</p>
                    <p className="mt-2 text-4xl font-black tracking-tight text-primary break-words">
                      ${Number(selectedDocument.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {selectedDocument.notes ? (
                    <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Notas</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
                        {selectedDocument.notes}
                      </p>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-3xl border border-border/50 bg-card/50 p-5 shadow-sm backdrop-blur-xl">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Historial de eventos</p>
                    <p className="mt-1 text-sm text-muted-foreground">Cambios de estado y referencias asociadas.</p>
                    {sourceDocumentLabel ? (
                      <Badge variant="secondary" className="mt-4 px-3 py-1 font-mono text-xs">
                        Origen: {sourceDocumentLabel}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    {selectedEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                        <Clock className="mx-auto h-8 w-8 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-medium text-muted-foreground">Sin eventos registrados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedEvents.map((event, i) => {
                          const described = describeDocumentHistoryEvent(event);
                          const toneColors = HISTORY_TONE_COLORS[described.tone] || HISTORY_TONE_COLORS.neutral;
                          const Icon = toneColors.icon;

                          return (
                            <div
                              key={event.id}
                              className="grid grid-cols-[14px_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
                            >
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
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                      {formatTimestampDate(event.created_at)}
                                    </Badge>
                                    <p className="mt-2 text-xs text-muted-foreground/70 font-mono">{formatTimestampTime(event.created_at)}</p>
                                  </div>
                                </div>
                                {i === 0 ? (
                                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-semibold">Más reciente</p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
