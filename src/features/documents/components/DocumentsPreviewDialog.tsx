import { Badge } from "@/components/ui/badge";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CompanySettings } from "@/contexts/company-brand-context";
import {
  CUSTOMER_KIND_LABEL,
  DOC_LABEL,
  DOC_TYPE_CLASS,
  HISTORY_DOT_CLASS,
  HISTORY_TONE_CLASS,
  INTERNAL_REMITO_LABEL,
  STATUS_LABEL,
} from "@/features/documents/constants";
import type { DocEventRow, DocLineRow, DocRow } from "@/features/documents/types";
import { describeDocumentHistoryEvent, formatNumber } from "@/features/documents/utils";

interface DocumentsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocument: DocRow | null;
  selectedLines: DocLineRow[];
  selectedEvents: DocEventRow[];
  sourceDocumentLabel: string | null;
  companySettings: CompanySettings;
}

export function DocumentsPreviewDialog({
  open,
  onOpenChange,
  selectedDocument,
  selectedLines,
  selectedEvents,
  sourceDocumentLabel,
  companySettings,
}: DocumentsPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Vista previa del documento</DialogTitle>
        </DialogHeader>
        {selectedDocument ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 max-h-[72vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-100 p-5 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <Badge variant="outline" className={DOC_TYPE_CLASS[selectedDocument.doc_type]}>
                        {DOC_LABEL[selectedDocument.doc_type]}
                      </Badge>
                      <div>
                        {companySettings.logo_url ? (
                          <img src={companySettings.logo_url} alt={companySettings.app_name} className="h-16 w-auto max-w-[220px] object-contain" />
                        ) : (
                          <p className="text-2xl font-black tracking-[0.12em] text-primary">{companySettings.app_name}</p>
                        )}
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {companySettings.document_tagline ?? "Documentacion comercial"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Documento</p>
                      <p className="mt-1 text-lg font-bold">{DOC_LABEL[selectedDocument.doc_type]}</p>
                      <p className="mt-2 text-xs text-slate-300">{formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/95 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Cliente</p>
                      <p className="mt-2 font-semibold">{selectedDocument.customer_name ?? "Cliente ocasional"}</p>
                      <p className="mt-1 text-sm text-slate-600">Tipo: {CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]}</p>
                      <p className="mt-1 text-sm text-slate-600">CUIT: {selectedDocument.customer_tax_id ?? "-"}</p>
                      <p className="text-sm text-slate-600">Condicion fiscal: {selectedDocument.customer_tax_condition ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/95 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Operacion</p>
                      <p className="mt-2 text-sm"><span className="font-semibold">Fecha:</span> {new Date(selectedDocument.issue_date).toLocaleDateString("es-AR")}</p>
                      <p className="text-sm"><span className="font-semibold">Estado:</span> {STATUS_LABEL[selectedDocument.status]}</p>
                      <p className="text-sm"><span className="font-semibold">Punto de venta:</span> {String(selectedDocument.point_of_sale).padStart(4, "0")}</p>
                      {selectedDocument.payment_terms ? (
                        <p className="text-sm"><span className="font-semibold">Condicion de venta:</span> {selectedDocument.payment_terms}</p>
                      ) : null}
                      {selectedDocument.salesperson ? (
                        <p className="text-sm"><span className="font-semibold">Vendedor:</span> {selectedDocument.salesperson}</p>
                      ) : null}
                      {selectedDocument.valid_until ? (
                        <p className="text-sm"><span className="font-semibold">Valido hasta:</span> {new Date(selectedDocument.valid_until).toLocaleDateString("es-AR")}</p>
                      ) : null}
                      {selectedDocument.delivery_address ? (
                        <p className="text-sm"><span className="font-semibold">Entrega:</span> {selectedDocument.delivery_address}</p>
                      ) : null}
                      {selectedDocument.internal_remito_type ? (
                        <p className="text-sm"><span className="font-semibold">Imputacion:</span> {INTERNAL_REMITO_LABEL[selectedDocument.internal_remito_type]}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border bg-card p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resumen</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border bg-[hsl(var(--accent))]/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total documento</p>
                      <p className="mt-2 text-3xl font-black text-primary">
                        ${Number(selectedDocument.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                      <p className="mt-2 text-sm text-muted-foreground">{selectedDocument.notes ?? "Sin observaciones cargadas."}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border">
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
            </div>

            <aside className="rounded-3xl border bg-card p-5 lg:max-h-[72vh] lg:overflow-y-auto">
              <div className="mb-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Historial</p>
                <p className="mt-1 text-sm text-muted-foreground">Linea de tiempo del documento.</p>
                {sourceDocumentLabel ? (
                  <Badge variant="outline" className="mt-3 border-slate-200 bg-slate-50 text-slate-700">
                    Origen: {sourceDocumentLabel}
                  </Badge>
                ) : null}
              </div>

              {selectedEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Todavia no hay eventos registrados para este documento.
                </div>
              ) : (
                <div className="relative pl-7">
                  <div className="absolute bottom-2 left-[11px] top-2 w-px rounded-full bg-gradient-to-b from-blue-200 via-emerald-200 to-slate-200" />
                  <div className="space-y-4">
                    {selectedEvents.map((event) => {
                      const described = describeDocumentHistoryEvent(event);
                      return (
                        <div key={event.id} className="relative">
                          <div className={`absolute left-[-21px] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-white shadow-md ${HISTORY_DOT_CLASS[described.tone]}`} />
                          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5 text-slate-900">{described.title}</p>
                                <p className="mt-1 text-sm leading-5 text-slate-500">{described.detail}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <Badge variant="outline" className={HISTORY_TONE_CLASS[described.tone]}>
                                  {new Date(event.created_at).toLocaleDateString("es-AR")}
                                </Badge>
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
