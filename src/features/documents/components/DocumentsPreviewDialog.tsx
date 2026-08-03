import { useState, type ReactNode } from "react";
import {
  ArrowRightCircle,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  FilePenLine,
  FilePlus2,
  Link2,
  LucideIcon,
  PlayCircle,
  ReceiptText,
  Trash2,
  XCircle,
} from "lucide-react";
import { CategoryBadge, CountBadge, InfoBadge, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySettings } from "@/contexts/company-brand-context";
import { DocumentConfirmationDialog } from "./DocumentConfirmationDialog";
import { CUSTOMER_KIND_LABEL, DOC_LABEL, INTERNAL_REMITO_LABEL, STATUS_LABEL } from "@/features/documents/constants";
import { canDuplicateDocumentType } from "@/features/documents/lib/duplicate";
import type { DocEventRow, DocLineRow, DocRow } from "@/features/documents/types";
import { describeDocumentHistoryEvent, formatNumber, resolveDocumentRecipient } from "@/features/documents/utils";
import { formatBusinessDate, formatTimestampDate, formatTimestampTime } from "@/lib/formatters";

interface DocumentsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocument: DocRow | null;
  selectedLines: DocLineRow[];
  selectedEvents: DocEventRow[];
  eventUserNamesById: Map<string, string>;
  sourceDocumentLabel: string | null;
  technicianName: string | null;
  companySettings: CompanySettings;
  isExternalInvoiceLocked: boolean;
  onSetExternalInvoice: (documentId: string, externalInvoiceNumber: string) => void;
  onClearExternalInvoice: (documentId: string) => void;
  isUpdatingExternalInvoice: boolean;
  canPrintDocument: boolean;
  onOpenPrint: (document: DocRow) => void;
  onDuplicateDocument: (document: DocRow) => void;
  isDuplicatingDocument: boolean;
  canDuplicateDocument: boolean;
  canRegisterInCash: boolean;
  isRegisteredInCash: boolean;
  onRegisterInCash: (document: DocRow) => void;
  serviceLinkLabel?: string | null;
  onOpenService?: () => void;
}

const HISTORY_TONE_COLORS: Record<string, { bg: string; border: string; text: string; line: string; icon: LucideIcon }> = {
  neutral: { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700", line: "bg-slate-200", icon: PlayCircle },
  info: { bg: "bg-sky-100", border: "border-sky-200", text: "text-sky-700", line: "bg-sky-200", icon: FilePenLine },
  success: { bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-700", line: "bg-emerald-200", icon: CheckCircle2 },
  warning: { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-700", line: "bg-amber-200", icon: Clock },
  danger: { bg: "bg-rose-100", border: "border-rose-200", text: "text-rose-700", line: "bg-rose-200", icon: XCircle },
};

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const DOC_ACCENT_CLASS: Record<DocRow["doc_type"], string> = {
  PRESUPUESTO: "from-blue-500 via-sky-400 to-slate-900",
  REMITO: "from-emerald-500 via-sky-500 to-slate-900",
  REMITO_DEVOLUCION: "from-amber-500 via-orange-400 to-slate-900",
};

const DOC_TOTAL_ACCENT_CLASS: Record<DocRow["doc_type"], string> = {
  PRESUPUESTO: "border-blue-500/60",
  REMITO: "border-emerald-500/60",
  REMITO_DEVOLUCION: "border-amber-500/70",
};

function formatMoney(value: number | string | null | undefined) {
  return moneyFormatter.format(Number(value) || 0);
}

function getHistoryIcon(eventType: string, fallback: LucideIcon) {
  switch (eventType) {
    case "CREATED":
      return FilePlus2;
    case "UPDATED":
      return FilePenLine;
    case "STATUS_CHANGED":
      return ArrowRightCircle;
    case "REMITO_EMITIDO":
      return CheckCircle2;
    case "EXTERNAL_INVOICE_SET":
    case "EXTERNAL_INVOICE_CLEARED":
      return ReceiptText;
    case "REMITO_CREATED_FROM_BUDGET":
    case "REMIO_CREATED_FROM_BUDGET":
      return ArrowRightLeft;
    case "DUPLICATED_FROM_DOCUMENT":
      return Copy;
    default:
      return fallback;
  }
}

function getEventActorName(event: DocEventRow, eventUserNamesById: Map<string, string>) {
  if (!event.created_by) return "Sistema";
  return eventUserNamesById.get(event.created_by) ?? "Usuario sin nombre";
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
    eventUserNamesById,
    sourceDocumentLabel,
    technicianName,
    companySettings,
    isExternalInvoiceLocked,
    onSetExternalInvoice,
    onClearExternalInvoice,
    isUpdatingExternalInvoice,
    canPrintDocument,
    onOpenPrint,
    onDuplicateDocument,
    isDuplicatingDocument,
    canDuplicateDocument,
    canRegisterInCash,
    isRegisteredInCash,
    onRegisterInCash,
    serviceLinkLabel,
    onOpenService,
  } = props;
  const [externalInvoiceDialogOpen, setExternalInvoiceDialogOpen] = useState(false);
  const [externalInvoiceNumber, setExternalInvoiceNumber] = useState("");
  const [clearExternalInvoiceOpen, setClearExternalInvoiceOpen] = useState(false);

  const handleSetExternalInvoice = () => {
    if (!selectedDocument) return;
    setExternalInvoiceNumber(selectedDocument.external_invoice_number ?? "");
    setExternalInvoiceDialogOpen(true);
  };

  const handleClearExternalInvoice = () => {
    if (!selectedDocument) return;
    setClearExternalInvoiceOpen(false);
    onClearExternalInvoice(selectedDocument.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(94vh,960px)] max-w-[min(98vw,1560px)] flex-col overflow-hidden border-slate-200 bg-slate-200/95 p-0 shadow-2xl backdrop-blur-xl [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-slate-300 [&>button]:bg-white [&>button]:text-slate-700 [&>button]:opacity-100 [&>button]:shadow-sm [&>button]:transition [&>button]:hover:border-slate-400 [&>button]:hover:bg-slate-100 [&>button]:hover:text-slate-950 [&>button]:focus:ring-slate-400 [&>button]:focus:ring-offset-slate-200 [&>button_svg]:h-4 [&>button_svg]:w-4">
        <DialogHeader className="shrink-0 border-b border-slate-300/70 bg-white px-6 py-4">
          <DialogTitle className="text-lg font-semibold tracking-tight text-slate-950">Vista previa del documento</DialogTitle>
          <DialogDescription>Revision comercial, productos y trazabilidad.</DialogDescription>
        </DialogHeader>

        {selectedDocument ? (
          <div className="grid min-h-0 flex-1 gap-4 p-4 2xl:grid-cols-[minmax(0,1.9fr)_minmax(360px,440px)]">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <div className="mx-auto max-w-[1040px] rounded-[22px] border border-slate-300 bg-white p-5 shadow-sm">
                <div className="overflow-hidden rounded-[18px] border border-slate-200">
                  <div className={`h-1.5 w-full bg-gradient-to-r ${DOC_ACCENT_CLASS[selectedDocument.doc_type]}`} />

                  <header className="grid gap-5 border-b border-slate-200 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="flex min-w-0 items-center gap-5">
                      <div className="flex h-24 w-44 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        {companySettings.logo_url ? (
                          <img src={companySettings.logo_url} alt={companySettings.app_name} className="max-h-full w-auto max-w-full object-contain" />
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
                        <CategoryBadge>
                          {DOC_LABEL[selectedDocument.doc_type]}
                        </CategoryBadge>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Documento</span>
                      </div>
                      <p className="mt-4 text-2xl font-black tracking-tight">{DOC_LABEL[selectedDocument.doc_type]}</p>
                      <p className="mt-2 font-mono text-sm text-slate-200">
                        {selectedDocument.document_number === null ? "Pendiente de numeracion" : formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-500">Fecha</p>
                          <p className="mt-1 font-semibold">{formatBusinessDate(selectedDocument.issue_date)}</p>
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
                      <PreviewField label={selectedDocument.customer_kind === "INTERNO" ? "Destinatario" : "Cliente"} value={resolveDocumentRecipient(selectedDocument, { technicianName }).primaryName} />
                      {selectedDocument.customer_kind === "INTERNO" && selectedDocument.internal_remito_type ? <PreviewField label="Tipo / motivo interno" value={INTERNAL_REMITO_LABEL[selectedDocument.internal_remito_type]} /> : null}
                      {selectedDocument.customer_kind !== "INTERNO" && resolveDocumentRecipient(selectedDocument, { technicianName }).secondaryName ? <PreviewField label="Nombre ocasional" value={resolveDocumentRecipient(selectedDocument, { technicianName }).secondaryName} /> : null}
                      <PreviewField label="Tipo" value={CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]} />
                      {selectedDocument.customer_kind !== "INTERNO" ? <PreviewField label="CUIT" value={<span className="font-mono">{selectedDocument.customer_tax_id ?? "-"}</span>} /> : null}
                      {selectedDocument.customer_kind !== "INTERNO" ? <PreviewField label="Cond. fiscal" value={selectedDocument.customer_tax_condition ?? "-"} /> : null}
                      <PreviewField label="PDV" value={<span className="font-mono">{String(selectedDocument.point_of_sale).padStart(4, "0")}</span>} />
                      <PreviewField label="Validez" value={selectedDocument.valid_until ? formatBusinessDate(selectedDocument.valid_until) : "-"} />
                      {selectedDocument.customer_kind !== "INTERNO" ? <PreviewField label="Condicion" value={selectedDocument.payment_terms ?? "-"} /> : null}
                      <PreviewField label="Vendedor" value={selectedDocument.salesperson ?? "-"} />
                      <PreviewField label="Tecnico" value={technicianName ?? "-"} />
                    </div>
                    <div className="space-y-4 p-5">
                      <PreviewField label="Entrega" value={selectedDocument.delivery_address ?? "-"} />
                      <PreviewField label="Origen" value={sourceDocumentLabel ? <span className="font-mono">{sourceDocumentLabel}</span> : "-"} />
                      {selectedDocument.doc_type === "REMITO_DEVOLUCION" ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">Devolucion</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            Ingresa stock contra el remito origen al emitirse.
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Factura externa</p>
                            <p className="mt-1 truncate font-mono text-sm font-black text-slate-950">
                              {selectedDocument.external_invoice_number ?? "Sin factura asociada"}
                            </p>
                          </div>
                          {selectedDocument.external_invoice_number ? (
                            <StatusBadge tone="success">
                              Asociada
                            </StatusBadge>
                          ) : null}
                        </div>
                      </div>
                      {selectedDocument.doc_type === "REMITO" && !isExternalInvoiceLocked ? (
                        <div className="grid gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Button type="button" size="sm" className="justify-start" onClick={handleSetExternalInvoice} disabled={isUpdatingExternalInvoice}>
                            <FilePenLine className="h-4 w-4" />
                            {selectedDocument.external_invoice_number ? "Editar factura externa" : "Registrar factura externa"}
                          </Button>
                          {selectedDocument.external_invoice_number ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                              onClick={() => setClearExternalInvoiceOpen(true)}
                              disabled={isUpdatingExternalInvoice}
                            >
                              <Trash2 className="h-4 w-4" />
                              Quitar
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="border-b border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Notas</p>
                    <p className="mt-2 min-h-6 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-800">
                      {selectedDocument.notes?.trim() || "-"}
                    </p>
                  </section>

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
                        <thead className="bg-slate-950 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                          <tr className="border-slate-800">
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
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resumen</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Vista previa operativa del documento. La firma se reserva para la impresion o PDF final.
                        </p>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className="space-y-2 bg-slate-50 p-4 text-sm">
                          <div className="flex justify-between gap-4 text-slate-600">
                            <span>Subtotal</span>
                            <span className="font-mono">{formatMoney(selectedDocument.subtotal)}</span>
                          </div>
                          <div className={`flex justify-between gap-4 border-b pb-3 text-slate-600 ${DOC_TOTAL_ACCENT_CLASS[selectedDocument.doc_type]}`}>
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
              <section className="overflow-hidden rounded-[22px] border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Historial</p>
                      <p className="mt-1 text-sm text-slate-500">Trazabilidad del documento.</p>
                    </div>
                    <CountBadge>
                      {selectedEvents.length} evento{selectedEvents.length === 1 ? "" : "s"}
                    </CountBadge>
                  </div>
                </div>

                <div className="space-y-3 border-b border-slate-200 bg-slate-50/80 p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado actual</p>
                      <p className="mt-2 text-sm font-black text-slate-950">{STATUS_LABEL[selectedDocument.status]}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Creado</p>
                      <p className="mt-2 text-sm font-black text-slate-950">{formatTimestampDate(selectedDocument.created_at)}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{formatTimestampTime(selectedDocument.created_at)}</p>
                    </div>
                  </div>

                {sourceDocumentLabel ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
                        <Link2 className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">Origen</p>
                        <p className="mt-1 truncate text-sm font-black text-slate-950">{sourceDocumentLabel}</p>
                      </div>
                    </div>
                ) : null}
                {serviceLinkLabel ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                      <Link2 className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Servicio asociado</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">{serviceLinkLabel}</p>
                      {onOpenService ? (
                        <Button type="button" size="sm" variant="outline" className="mt-2 h-8 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100" onClick={onOpenService}>
                          Abrir trabajo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                </div>

                {selectedEvents.length === 0 ? (
                  <div className="m-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                    <Clock className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-500">No hay eventos para mostrar</p>
                  </div>
                ) : (
                  <div className="p-5">
                    {selectedEvents.map((event, index) => {
                      const described = describeDocumentHistoryEvent(event);
                      const toneColors = HISTORY_TONE_COLORS[described.tone] || HISTORY_TONE_COLORS.neutral;
                      const Icon = getHistoryIcon(event.event_type, toneColors.icon);
                      const actorName = getEventActorName(event, eventUserNamesById);
                      const isLast = index === selectedEvents.length - 1;
                      return (
                        <div key={event.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                          <div className="relative flex justify-center">
                            {!isLast ? <div className={`absolute top-9 bottom-[-20px] w-px ${toneColors.line}`} /> : null}
                            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm ${toneColors.border}`}>
                              <Icon className={`h-4 w-4 ${toneColors.text}`} strokeWidth={2.5} />
                            </div>
                          </div>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-black leading-5 text-slate-950">{described.title}</p>
                                  {index === 0 ? <InfoBadge>Reciente</InfoBadge> : null}
                                </div>
                                <p className="mt-1 text-sm leading-5 text-slate-600">{described.detail}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">{actorName}</span>
                              <span>{formatTimestampDate(event.created_at)}</span>
                              <span className="font-mono">{formatTimestampTime(event.created_at)}</span>
                            </div>
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

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-300/70 bg-white px-5 py-4">
          {selectedDocument?.doc_type === "REMITO" && selectedDocument.status === "EMITIDO" ? (
            isRegisteredInCash ? (
              <StatusBadge tone="success" className="self-center">
                Registrado en Caja
              </StatusBadge>
            ) : canRegisterInCash ? (
              <Button
                type="button"
                variant="outline"
                className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                onClick={() => onRegisterInCash(selectedDocument)}
              >
                <Banknote className="h-4 w-4" />
                Registrar en Caja
              </Button>
            ) : null
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="border-slate-400 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-950"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (selectedDocument) onOpenPrint(selectedDocument);
            }}
            disabled={!selectedDocument || !canPrintDocument}
          >
            Abrir impresion
          </Button>
          {selectedDocument && canDuplicateDocumentType(selectedDocument.doc_type) ? (
            <Button
              type="button"
              variant="outline"
              className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
              onClick={() => {
                if (selectedDocument) onDuplicateDocument(selectedDocument);
              }}
              disabled={isDuplicatingDocument || !canDuplicateDocument}
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
          ) : null}
        </div>
        </DialogContent>
      </Dialog>

      <Dialog open={externalInvoiceDialogOpen} onOpenChange={setExternalInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedDocument || !externalInvoiceNumber.trim()) return;
              onSetExternalInvoice(selectedDocument.id, externalInvoiceNumber.trim());
              setExternalInvoiceDialogOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {selectedDocument?.external_invoice_number
                  ? "Editar factura externa"
                  : "Registrar factura externa"}
              </DialogTitle>
              <DialogDescription>
                Esta referencia identifica el comprobante asociado al remito y se mostrara en su trazabilidad.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="external-invoice-number">Numero de factura</Label>
              <Input
                id="external-invoice-number"
                autoFocus
                placeholder="Ej. 0001-00001234"
                value={externalInvoiceNumber}
                onChange={(event) => setExternalInvoiceNumber(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExternalInvoiceDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!externalInvoiceNumber.trim() || isUpdatingExternalInvoice}>
                {isUpdatingExternalInvoice ? "Guardando..." : "Guardar referencia"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DocumentConfirmationDialog
        open={clearExternalInvoiceOpen}
        title="Quitar factura externa"
        description="El remito quedara sin la referencia de factura asociada. La accion se registrara en su historial."
        confirmLabel="Quitar referencia"
        tone="danger"
        isPending={isUpdatingExternalInvoice}
        onOpenChange={setClearExternalInvoiceOpen}
        onConfirm={handleClearExternalInvoice}
      />
    </>
  );
}
