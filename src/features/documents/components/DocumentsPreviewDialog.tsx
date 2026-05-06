import type { ReactNode } from "react";
import { CheckCircle2, Clock, LucideIcon, PlayCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function formatMoney(value: number | string | null | undefined) {
  return moneyFormatter.format(Number(value) || 0);
}

function PreviewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

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
      <DialogContent className="flex h-[min(94vh,960px)] max-w-[min(98vw,1560px)] flex-col overflow-hidden border-slate-200 bg-slate-200/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="shrink-0 border-b border-slate-300/70 bg-white px-6 py-4">
          <DialogTitle className="text-lg font-semibold tracking-tight text-slate-950">Vista previa del documento</DialogTitle>
          <DialogDescription>Revision comercial, productos y trazabilidad.</DialogDescription>
        </DialogHeader>

        {selectedDocument ? (
          <div className="grid min-h-0 flex-1 gap-4 p-4 2xl:grid-cols-[minmax(0,1.9fr)_minmax(360px,440px)]">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <div className="mx-auto max-w-[1040px] rounded-[22px] border border-slate-300 bg-white p-5 shadow-sm">
                <div className="overflow-hidden rounded-[18px] border border-slate-200">
                  <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-slate-900" />

                  <header className="grid gap-5 border-b border-slate-200 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="flex min-w-0 items-center gap-5">
                      <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {companySettings.logo_url ? (
                          <img src={companySettings.logo_url} alt={companySettings.app_name} className="max-h-20 w-auto max-w-full object-contain" />
                        ) : (
                          <span className="text-3xl font-black text-slate-900">{companySettings.app_name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-black tracking-tight text-slate-950">{companySettings.app_name}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                          {companySettings.document_tagline ?? "Documentacion comercial"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                          {companySettings.tax_id ? <span>CUIT {companySettings.tax_id}</span> : null}
                          {companySettings.phone ? <span>Tel. {companySettings.phone}</span> : null}
                          {companySettings.email ? <span>{companySettings.email}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                      <div className="flex items-start justify-between gap-3">
                        <Badge variant="outline" className={DOC_TYPE_CLASS[selectedDocument.doc_type]}>
                          {DOC_LABEL[selectedDocument.doc_type]}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Documento</span>
                      </div>
                      <p className="mt-4 text-2xl font-black tracking-tight">{DOC_LABEL[selectedDocument.doc_type]}</p>
                      <p className="mt-2 font-mono text-sm text-slate-200">
                        {selectedDocument.document_number === null ? "Pendiente de numeracion" : formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-500">Fecha</p>
                          <p className="mt-1 font-semibold">{formatIsoDate(selectedDocument.issue_date)}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-500">Estado</p>
                          <p className="mt-1 font-semibold">{STATUS_LABEL[selectedDocument.status]}</p>
                        </div>
                      </div>
                    </div>
                  </header>

                  <section className="grid border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid gap-x-5 gap-y-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:border-b-0 lg:border-r">
                      <PreviewField label="Cliente" value={selectedDocument.customer_name ?? "Cliente ocasional"} />
                      <PreviewField label="Tipo" value={CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]} />
                      <PreviewField label="CUIT" value={<span className="font-mono">{selectedDocument.customer_tax_id ?? "-"}</span>} />
                      <PreviewField label="Cond. fiscal" value={selectedDocument.customer_tax_condition ?? "-"} />
                      <PreviewField label="PDV" value={<span className="font-mono">{String(selectedDocument.point_of_sale).padStart(4, "0")}</span>} />
                      <PreviewField label="Validez" value={selectedDocument.valid_until ? formatIsoDate(selectedDocument.valid_until) : "-"} />
                      <PreviewField label="Condicion" value={selectedDocument.payment_terms ?? "-"} />
                      <PreviewField label="Vendedor" value={selectedDocument.salesperson ?? "-"} />
                    </div>
                    <div className="space-y-4 p-5">
                      <PreviewField label="Entrega" value={selectedDocument.delivery_address ?? "-"} />
                      <PreviewField label="Origen" value={sourceDocumentLabel ? <span className="font-mono">{sourceDocumentLabel}</span> : "-"} />
                      <PreviewField label="Factura externa" value={selectedDocument.external_invoice_number ? <span className="font-mono">{selectedDocument.external_invoice_number}</span> : "-"} />
                      {selectedDocument.doc_type === "REMITO" && !isExternalInvoiceLocked ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button type="button" size="sm" onClick={handleSetExternalInvoice} disabled={isUpdatingExternalInvoice}>
                            {selectedDocument.external_invoice_number ? "Editar factura externa" : "Registrar factura externa"}
                          </Button>
                          {selectedDocument.external_invoice_number ? (
                            <Button type="button" size="sm" variant="outline" onClick={handleClearExternalInvoice} disabled={isUpdatingExternalInvoice}>
                              Quitar
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {selectedDocument.notes ? (
                    <section className="border-b border-slate-200 bg-slate-50/70 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Notas</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-800">{selectedDocument.notes}</p>
                    </section>
                  ) : null}

                  <section className="p-5">
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Productos</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedLines.length} producto{selectedLines.length === 1 ? "" : "s"} cargado{selectedLines.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed border-collapse text-sm">
                        <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            <th className="w-12 px-3 py-3 text-left">#</th>
                            <th className="px-3 py-3 text-left">Descripcion</th>
                            <th className="w-20 px-3 py-3 text-right">Cant.</th>
                            <th className="w-20 px-3 py-3 text-left">Unidad</th>
                            <th className="w-28 px-3 py-3 text-right">P. unit.</th>
                            <th className="w-28 px-3 py-3 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {selectedLines.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                                Sin productos para mostrar
                              </td>
                            </tr>
                          ) : (
                            selectedLines.map((line) => (
                              <tr key={line.id} className="hover:bg-emerald-50/40">
                                <td className="px-3 py-3 text-xs font-bold text-slate-500">{line.line_order}</td>
                                <td className="px-3 py-3 font-semibold leading-5 text-slate-900">{line.description}</td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-800">{Number(line.quantity).toLocaleString("es-AR")}</td>
                                <td className="px-3 py-3 text-slate-600">{line.unit ?? "un"}</td>
                                <td className="px-3 py-3 text-right font-mono text-xs text-slate-700">{formatMoney(line.unit_price)}</td>
                                <td className="px-3 py-3 text-right font-mono text-xs font-black text-slate-950">{formatMoney(line.line_total)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Firma / conformidad</p>
                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                          <div className="border-t border-slate-400 pt-2 text-xs font-semibold text-slate-500">Firma</div>
                          <div className="border-t border-slate-400 pt-2 text-xs font-semibold text-slate-500">Aclaracion</div>
                          <div className="border-t border-slate-400 pt-2 text-xs font-semibold text-slate-500">Documento</div>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className="space-y-2 bg-slate-50 p-4 text-sm">
                          <div className="flex justify-between gap-4 text-slate-600">
                            <span>Subtotal</span>
                            <span className="font-mono">{formatMoney(selectedDocument.subtotal)}</span>
                          </div>
                          <div className="flex justify-between gap-4 border-b border-emerald-500/60 pb-3 text-slate-600">
                            <span>IVA / imp.</span>
                            <span className="font-mono">{formatMoney(selectedDocument.tax_total)}</span>
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 text-white">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total documento</p>
                          <p className="mt-1 text-3xl font-black tracking-tight">{formatMoney(selectedDocument.total)}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:stable] 2xl:min-w-[360px]">
              <section className="rounded-[22px] border border-slate-300 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Historial</p>
                <p className="mt-1 text-sm text-slate-500">Trazabilidad del documento.</p>
                {sourceDocumentLabel ? (
                  <Badge variant="secondary" className="mt-4 px-3 py-1 font-mono text-xs">
                    Origen: {sourceDocumentLabel}
                  </Badge>
                ) : null}

                {selectedEvents.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                    <Clock className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-500">No hay eventos para mostrar</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {selectedEvents.map((event, index) => {
                      const described = describeDocumentHistoryEvent(event);
                      const toneColors = HISTORY_TONE_COLORS[described.tone] || HISTORY_TONE_COLORS.neutral;
                      const Icon = toneColors.icon;
                      return (
                        <div key={event.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <div className="relative flex justify-center">
                            <div className="absolute top-0 bottom-0 w-px bg-slate-200" />
                            <div className={`relative mt-1.5 flex h-6 w-6 items-center justify-center rounded-full border ${toneColors.bg} ${toneColors.border}`}>
                              <Icon className={`h-3.5 w-3.5 ${toneColors.text}`} strokeWidth={3} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5 text-slate-900">{described.title}</p>
                                <p className="mt-1 text-sm leading-5 text-slate-500">{described.detail}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <Badge variant="outline" className="border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
                                  {formatTimestampDate(event.created_at)}
                                </Badge>
                                <p className="mt-2 text-xs font-mono text-slate-500">{formatTimestampTime(event.created_at)}</p>
                              </div>
                            </div>
                            {index === 0 ? <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Mas reciente</p> : null}
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
