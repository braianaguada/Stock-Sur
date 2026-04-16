import { CheckCircle2, Clock, FileText, LucideIcon, PlayCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CompanySettings } from "@/contexts/company-brand-context";
import {
  CUSTOMER_KIND_LABEL,
  DOC_LABEL,
  DOC_TYPE_CLASS,
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
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">Vista previa del documento</DialogTitle>
        </DialogHeader>
        {selectedDocument ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_380px]">
            <div className="min-w-0 max-h-[76vh] space-y-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
              
              {/* Premium A4 White Paper Representation */}
              <div className="relative group mx-1 mt-1">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-700" />
                
                <div className="relative overflow-hidden rounded-[20px] border border-slate-200/60 bg-white p-6 md:p-8 text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                  
                  {/* Huge Watermark */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0">
                    <span className="text-[clamp(60px,10vw,140px)] font-black tracking-[0.2em] text-slate-900/[0.03] -rotate-45 select-none whitespace-nowrap">
                      {DOC_LABEL[selectedDocument.doc_type]}
                    </span>
                  </div>

                  <div className="relative z-10 mb-6 flex items-start justify-between gap-4">
                    <div className="space-y-4">
                      <Badge variant="outline" className={`${DOC_TYPE_CLASS[selectedDocument.doc_type]} shadow-sm`}>
                        {DOC_LABEL[selectedDocument.doc_type]}
                      </Badge>
                      <div>
                        {companySettings.logo_url ? (
                          <img src={companySettings.logo_url} alt={companySettings.app_name} className="h-16 w-auto max-w-[220px] object-contain" />
                        ) : (
                          <p className="text-2xl font-black tracking-[0.08em] text-primary drop-shadow-sm">{companySettings.app_name}</p>
                        )}
                        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">
                          {companySettings.document_tagline ?? "Documentación comercial"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Floating Document Box */}
                    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 px-5 py-4 text-right text-white shadow-xl ring-1 ring-white/10">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-1">Documento</p>
                      <p className="text-xl font-extrabold tracking-tight">{DOC_LABEL[selectedDocument.doc_type]}</p>
                      <div className="mt-2 text-sm text-slate-300 font-mono tracking-wider bg-white/10 inline-block px-3 py-1 rounded-md">
                        Nro: {formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}
                      </div>
                    </div>
                  </div>

                  {/* Customer and Operation Cards */}
                  <div className="relative z-10 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 backdrop-blur-sm p-5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-3 w-3" /> Cliente
                      </p>
                      <p className="font-bold text-lg text-slate-800">{selectedDocument.customer_name ?? "Cliente ocasional"}</p>
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        <p>Tipo: <span className="font-medium text-slate-700">{CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]}</span></p>
                        <p>CUIT: <span className="font-mono">{selectedDocument.customer_tax_id ?? "-"}</span></p>
                        <p>Cond. fiscal: <span className="font-medium text-slate-700">{selectedDocument.customer_tax_condition ?? "-"}</span></p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 backdrop-blur-sm p-5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3">Operación</p>
                      <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600">
                        <p>Fecha:</p>
                        <p className="font-medium text-slate-800">{new Date(selectedDocument.issue_date).toLocaleDateString("es-AR")}</p>
                        
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
                            <p className="font-mono font-medium text-slate-800">
                              {selectedDocument.external_invoice_number}
                          </p>
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
                            <p className="font-medium text-slate-800">{new Date(selectedDocument.valid_until).toLocaleDateString("es-AR")}</p>
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
                            variant="outline"
                            size="sm"
                            onClick={handleSetExternalInvoice}
                            disabled={isUpdatingExternalInvoice}
                          >
                            {selectedDocument.external_invoice_number ? "Editar factura externa" : "Registrar factura externa"}
                          </Button>
                          {selectedDocument.external_invoice_number ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleClearExternalInvoice}
                              disabled={isUpdatingExternalInvoice}
                            >
                              Quitar factura externa
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Wrapped Line Items Table */}
                  <div className="relative z-10 mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-black/[0.02]">
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
              </div>
            </div>

            {/* Right Column: Resumen & Historial */}
            <div className="flex flex-col gap-6 max-h-[76vh] overflow-y-auto pr-2 pb-6 custom-scrollbar">
              
              {/* Sleek Resumen Card */}
              <div className="rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold flex items-center gap-2">
                  Resumen Económico
                </p>
                <div className="mt-5 space-y-4 relative z-10">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
                    <p className="text-xs uppercase tracking-[0.15em] text-foreground/60 mb-1">Total a Pagar</p>
                    <p className="text-4xl font-black tracking-tight text-primary break-all">
                      ${Number(selectedDocument.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {selectedDocument.notes && (
                    <div className="rounded-2xl border border-border bg-background/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Notas</p>
                      <p className="text-sm leading-relaxed text-foreground/80">{selectedDocument.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Timeline (Historial) */}
              <aside className="rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl p-6 shadow-sm flex-1">
                <div className="mb-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Historial de Eventos</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Ciclo de vida del documento.</p>
                  {sourceDocumentLabel ? (
                    <Badge variant="secondary" className="mt-4 px-3 py-1 font-mono text-xs">
                      Origen: {sourceDocumentLabel}
                    </Badge>
                  ) : null}
                </div>

                {selectedEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-border/60 rounded-2xl bg-muted/20">
                    <Clock className="h-8 w-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Sin eventos registrados</p>
                  </div>
                ) : (
                  <div className="relative pl-[26px]">
                    {/* Sleek Line Line */}
                    <div className="absolute bottom-2 left-[11px] top-2 w-[2px] rounded-full bg-border/80" />
                    <div className="space-y-6">
                      {selectedEvents.map((event, i) => {
                        const described = describeDocumentHistoryEvent(event);
                        const toneColors = HISTORY_TONE_COLORS[described.tone] || HISTORY_TONE_COLORS.neutral;
                        const Icon = toneColors.icon;
                        const isLatest = i === 0;

                        return (
                          <div key={event.id} className="relative group">
                            {/* Halo / Icon Wrapper */}
                            <div className="absolute left-[-35px] top-1">
                              <div className={`relative flex h-5 w-5 items-center justify-center rounded-full ${toneColors.bg} border ${toneColors.border} ${isLatest ? 'ring-4 ring-background shadow-sm' : 'opacity-80'}`}>
                                <Icon className={`h-3 w-3 ${toneColors.text}`} strokeWidth={3} />
                              </div>
                            </div>

                            {/* Event Card */}
                            <div className="ml-2">
                              <div className="flex flex-col justify-start">
                                <span className={`text-sm font-semibold tracking-tight ${isLatest ? 'text-foreground' : 'text-foreground/70'}`}>
                                  {described.title}
                                </span>
                                <span className="mt-0.5 text-xs text-muted-foreground leading-snug pr-4">
                                  {described.detail}
                                </span>
                                <div className="mt-2 flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-border/60 bg-muted/30 ${toneColors.text}`}>
                                    {new Date(event.created_at).toLocaleDateString("es-AR")}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                                    {new Date(event.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
