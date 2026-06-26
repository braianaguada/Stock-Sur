import type { ReactNode } from "react";
import {
  ArrowRightCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Copy,
  FilePenLine,
  FilePlus2,
  LucideIcon,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CompanySettings } from "@/contexts/company-brand-context";
import { SERVICE_DOCUMENT_PREFIX, SERVICE_STATUS_LABEL } from "@/features/services/constants";
import type { ServiceDocument, ServiceDocumentEvent, ServiceDocumentLine, ServiceDocumentStatus } from "@/features/services/types";
import { formatIsoDate, formatMoney, formatTimestampDate, formatTimestampTime } from "@/lib/formatters";

type ServiceDocumentPreviewDialogProps = {
  open: boolean;
  onClose: () => void;
  previewDocument: ServiceDocument | null;
  previewLines: ServiceDocumentLine[];
  previewAttachments?: import("@/features/services/types").ServiceDocumentAttachment[];
  selectedEvents: ServiceDocumentEvent[];
  eventUserNamesById: Map<string, string>;
  settings: CompanySettings;
  onOpenPrint: (document: ServiceDocument) => void;
};

const SERVICE_PREVIEW_STATUS_BADGE_CLASS: Record<ServiceDocumentStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  SENT: "border-sky-200 bg-sky-50 text-sky-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-amber-200 bg-amber-50 text-amber-700",
};

const SERVICE_PREVIEW_ACCENT_CLASS: Record<ServiceDocument["type"], string> = {
  QUOTE: "from-blue-500 via-sky-400 to-slate-900",
  REMITO: "from-teal-500 via-emerald-400 to-slate-900",
};

const SERVICE_PREVIEW_TOTAL_ACCENT_CLASS: Record<ServiceDocument["type"], string> = {
  QUOTE: "border-blue-500/60",
  REMITO: "border-teal-500/60",
};

const SERVICE_HISTORY_TONE_COLORS: Record<string, { border: string; text: string; line: string; icon: LucideIcon }> = {
  neutral: { border: "border-slate-200", text: "text-slate-700", line: "bg-slate-200", icon: PlayCircle },
  info: { border: "border-sky-200", text: "text-sky-700", line: "bg-sky-200", icon: FilePenLine },
  success: { border: "border-emerald-200", text: "text-emerald-700", line: "bg-emerald-200", icon: CheckCircle2 },
  warning: { border: "border-amber-200", text: "text-amber-700", line: "bg-amber-200", icon: Clock },
  danger: { border: "border-rose-200", text: "text-rose-700", line: "bg-rose-200", icon: XCircle },
};

const formatDocumentNumber = (document: ServiceDocument) =>
  `${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")}`;

function describeServiceHistoryEvent(event: ServiceDocumentEvent) {
  switch (event.event_type) {
    case "CREATED":
      return { title: "Documento creado", detail: "Borrador inicial", tone: "neutral" as const };
    case "UPDATED":
      return { title: "Documento actualizado", detail: "Se guardaron cambios", tone: "info" as const };
    case "STATUS_CHANGED": {
      const from = typeof event.payload?.from === "string" ? event.payload.from : null;
      const to = typeof event.payload?.to === "string" ? event.payload.to : null;
      const fromLabel = from && from in SERVICE_STATUS_LABEL ? SERVICE_STATUS_LABEL[from as ServiceDocumentStatus] : from;
      const toLabel = to && to in SERVICE_STATUS_LABEL ? SERVICE_STATUS_LABEL[to as ServiceDocumentStatus] : to;
      const tone = to === "APPROVED" ? "success" : to === "REJECTED" ? "warning" : to === "CANCELLED" ? "danger" : "info";
      return {
        title: "Cambio de estado",
        detail: fromLabel && toLabel ? `${fromLabel} -> ${toLabel}` : toLabel ? `Estado cambiado a ${toLabel}` : "Estado actualizado",
        tone,
      };
    }
    case "DUPLICATED":
      return { title: "Documento duplicado", detail: "Creado a partir de otro documento de servicio", tone: "info" as const };
    case "CONVERTED_TO_REMITO":
      return { title: "Convertido a remito", detail: "Se genero un remito desde este presupuesto", tone: "success" as const };
    default:
      return { title: event.event_type.replaceAll("_", " "), detail: "Evento registrado", tone: "neutral" as const };
  }
}

function getServiceHistoryIcon(eventType: string, fallback: LucideIcon) {
  switch (eventType) {
    case "CREATED":
      return FilePlus2;
    case "UPDATED":
      return FilePenLine;
    case "STATUS_CHANGED":
      return ArrowRightCircle;
    case "DUPLICATED":
      return Copy;
    case "CONVERTED_TO_REMITO":
      return ArrowRightLeft;
    default:
      return fallback;
  }
}

function getServiceEventActorName(event: ServiceDocumentEvent, eventUserNamesById: Map<string, string>) {
  if (!event.created_by) return "Sistema";
  return eventUserNamesById.get(event.created_by) ?? "Usuario sin nombre";
}

export function ServiceDocumentPreviewDialog({
  open,
  onClose,
  previewDocument,
  previewLines,
  previewAttachments = [],
  selectedEvents,
  eventUserNamesById,
  settings,
  onOpenPrint,
}: ServiceDocumentPreviewDialogProps) {
  const documentTitle = previewDocument?.type === "REMITO" ? "Remito de servicio" : "Presupuesto de servicio";
  const previewTitle = previewDocument?.type === "REMITO"
    ? "Vista previa del remito de servicio"
    : "Vista previa del presupuesto de servicio";
  const brandName = settings.app_name || settings.legal_name || "Stock Sur";
  const legalName = settings.legal_name || brandName;
  const showLinePrices = previewDocument ? previewDocument.pricing_mode !== "GLOBAL_TOTAL" && !previewDocument.hide_line_prices : true;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex h-[min(94vh,960px)] max-w-[min(97vw,1540px)] flex-col overflow-hidden border-slate-300/80 bg-slate-200/95 p-0 shadow-2xl backdrop-blur-xl [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-slate-300 [&>button]:bg-white [&>button]:text-slate-700 [&>button]:opacity-100 [&>button]:shadow-sm [&>button]:transition [&>button]:hover:border-slate-400 [&>button]:hover:bg-slate-100 [&>button]:hover:text-slate-950 [&>button]:focus:ring-slate-400 [&>button]:focus:ring-offset-slate-200 [&>button_svg]:h-4 [&>button_svg]:w-4">
        <DialogHeader className="border-b border-slate-300/70 bg-white px-5 py-4">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950">{previewTitle}</DialogTitle>
          <DialogDescription className="text-slate-500">Revision visual antes de imprimir o guardar el PDF.</DialogDescription>
        </DialogHeader>

        {previewDocument ? (
          <div className="grid flex-1 min-h-0 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(330px,390px)]">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <section className="mx-auto min-h-full max-w-[1050px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
                <div className={`h-2 bg-gradient-to-r ${SERVICE_PREVIEW_ACCENT_CLASS[previewDocument.type]}`} />

                <div className="grid gap-5 border-b border-slate-200 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(310px,.8fr)]">
                  <div className="flex min-w-0 items-center gap-5">
                    <div className="flex h-28 w-44 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt={brandName} className="max-h-24 max-w-full object-contain" />
                      ) : (
                        <span className="text-2xl font-black tracking-tight text-slate-400">{brandName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Documentacion comercial</p>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{legalName}</h3>
                      <p className="mt-1 text-sm font-medium text-slate-500">{settings.document_tagline ?? "Servicios tecnicos y presupuestos"}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {settings.tax_id ? <span>CUIT {settings.tax_id}</span> : null}
                        {settings.phone ? <span>{settings.phone}</span> : null}
                        {settings.email ? <span>{settings.email}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Servicio</p>
                        <h4 className="mt-2 text-2xl font-black tracking-tight">{documentTitle}</h4>
                      </div>
                      <Badge variant="outline" className={SERVICE_PREVIEW_STATUS_BADGE_CLASS[previewDocument.status]}>
                        {SERVICE_STATUS_LABEL[previewDocument.status]}
                      </Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-bold uppercase tracking-[0.18em] text-slate-500">Numero</p>
                        <p className="mt-1 font-semibold">{formatDocumentNumber(previewDocument)}</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase tracking-[0.18em] text-slate-500">Fecha</p>
                        <p className="mt-1 font-semibold">{formatIsoDate(previewDocument.issue_date)}</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase tracking-[0.18em] text-slate-500">Estado</p>
                        <p className="mt-1 font-semibold">{SERVICE_STATUS_LABEL[previewDocument.status]}</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase tracking-[0.18em] text-slate-500">Vigencia</p>
                        <p className="mt-1 font-semibold">{previewDocument.valid_until ? formatIsoDate(previewDocument.valid_until) : "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 border-b border-slate-200 px-6 py-4 lg:grid-cols-2">
                  <PreviewPanel title="Cliente">
                    <PreviewFact label="Nombre" value={previewDocument.customers?.name ?? "Sin cliente"} strong />
                    <PreviewFact label="CUIT" value={previewDocument.customers?.cuit || "-"} />
                    <PreviewFact label="Referencia" value={previewDocument.reference || "-"} />
                  </PreviewPanel>
                  <PreviewPanel title="Operacion">
                    <PreviewFact label="Plazo" value={previewDocument.delivery_time || "-"} />
                    <PreviewFact label="Pago" value={previewDocument.payment_terms || "-"} />
                    <PreviewFact label="Entrega" value={previewDocument.delivery_location || "-"} />
                  </PreviewPanel>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <PreviewTextSection title="Introduccion" value={previewDocument.intro_text} />

                  <section>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Trabajos</p>
                        <p className="mt-1 text-sm text-slate-500">Detalle del servicio presupuestado.</p>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">{previewLines.length} item{previewLines.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <Table>
                        <TableHeader className="bg-slate-950">
                          <TableRow className="border-slate-800 hover:bg-slate-950">
                            <TableHead className="h-9 w-10 text-xs font-black uppercase tracking-[0.18em] text-slate-300">#</TableHead>
                            <TableHead className="h-9 text-xs font-black uppercase tracking-[0.18em] text-slate-300">Descripcion</TableHead>
                            <TableHead className="h-9 w-20 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-300">Cant.</TableHead>
                            <TableHead className="h-9 w-20 text-xs font-black uppercase tracking-[0.18em] text-slate-300">Unidad</TableHead>
                            {showLinePrices ? <TableHead className="h-9 w-28 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-300">P. unit.</TableHead> : null}
                            {showLinePrices ? <TableHead className="h-9 w-28 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-300">Total</TableHead> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewLines.length > 0 ? (
                            previewLines.map((line, index) => (
                              <TableRow key={line.id ?? `${line.sort_order}-${line.description}`} className="border-slate-200">
                                <TableCell className="py-2 text-xs font-semibold text-slate-500">{index + 1}</TableCell>
                                <TableCell className="py-2 text-sm font-semibold leading-5 text-slate-950">{line.description || "-"}</TableCell>
                                <TableCell className="py-2 text-right text-sm text-slate-700">{line.quantity ?? "-"}</TableCell>
                                <TableCell className="py-2 text-sm text-slate-700">{line.unit || "-"}</TableCell>
                                {showLinePrices ? <TableCell className="py-2 text-right text-sm text-slate-700">{formatMoney(line.unit_price ?? 0, previewDocument.currency)}</TableCell> : null}
                                {showLinePrices ? <TableCell className="py-2 text-right text-sm font-black text-slate-950">{formatMoney(line.line_total ?? 0, previewDocument.currency)}</TableCell> : null}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={showLinePrices ? 6 : 4} className="py-6 text-center text-sm text-slate-500">Sin trabajos cargados</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </section>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-4">
                      <PreviewTextSection title="Cierre" value={previewDocument.closing_text} />
                      {previewAttachments.filter((attachment) => attachment.include_in_print).length > 0 ? (
                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Imagenes / referencias</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {previewAttachments.filter((attachment) => attachment.include_in_print).map((attachment) => (
                              <figure key={attachment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                {attachment.signed_url ? <img src={attachment.signed_url} alt={attachment.title || attachment.file_name} className="h-36 w-full rounded-md object-contain" /> : null}
                                {attachment.title ? <figcaption className="mt-2 text-xs font-bold text-slate-900">{attachment.title}</figcaption> : null}
                                {attachment.description ? <p className="mt-1 text-xs text-slate-500">{attachment.description}</p> : null}
                              </figure>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </div>
                    <div className={`self-start rounded-2xl border border-slate-200 border-t-4 bg-slate-50 p-4 ${SERVICE_PREVIEW_TOTAL_ACCENT_CLASS[previewDocument.type]}`}>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600">
                        <span>Subtotal sin IVA</span>
                        <span className="font-semibold text-slate-950">{formatMoney(previewDocument.subtotal ?? previewDocument.total ?? 0, previewDocument.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-200 py-2 text-sm text-slate-600">
                        <span>IVA</span>
                        <span className="font-semibold text-slate-500">No incluido</span>
                      </div>
                      <div className="pt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total sin IVA</p>
                        <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{formatMoney(previewDocument.total ?? 0, previewDocument.currency)}</p>
                        {previewDocument.currency === "USD" && previewDocument.exchange_rate ? (
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                            BNA: 1 USD = {formatMoney(previewDocument.exchange_rate, "ARS")} · Estimado {formatMoney(Number(previewDocument.total ?? 0) * Number(previewDocument.exchange_rate), "ARS")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Historial</p>
                      <p className="mt-1 text-sm text-slate-500">Trazabilidad del documento.</p>
                    </div>
                    <Badge variant="outline" className="border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {selectedEvents.length} evento{selectedEvents.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50/80 p-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado actual</p>
                    <p className="mt-2 text-sm font-black text-slate-950">{SERVICE_STATUS_LABEL[previewDocument.status]}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Creado</p>
                    <p className="mt-2 text-sm font-black text-slate-950">{formatTimestampDate(previewDocument.created_at)}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{formatTimestampTime(previewDocument.created_at)}</p>
                  </div>
                </div>

                {selectedEvents.length === 0 ? (
                  <div className="m-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center">
                    <Clock className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-500">Sin eventos registrados</p>
                  </div>
                ) : (
                  <div className="p-4">
                    {selectedEvents.map((event, index) => {
                      const described = describeServiceHistoryEvent(event);
                      const toneColors = SERVICE_HISTORY_TONE_COLORS[described.tone] || SERVICE_HISTORY_TONE_COLORS.neutral;
                      const Icon = getServiceHistoryIcon(event.event_type, toneColors.icon);
                      const actorName = getServiceEventActorName(event, eventUserNamesById);
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black leading-5 text-slate-950">{described.title}</p>
                              {index === 0 ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                  Reciente
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-5 text-slate-600">{described.detail}</p>
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
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">No se pudo cargar la vista previa.</div>
        )}

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-300/70 bg-white px-5 py-4">
          <Button
            variant="outline"
            className="border-slate-400 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-950"
            onClick={onClose}
          >
            Cerrar
          </Button>
          <Button type="button" onClick={() => { if (previewDocument) onOpenPrint(previewDocument); }} disabled={!previewDocument}>
            Abrir impresión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function PreviewFact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[94px_minmax(0,1fr)] gap-3 border-b border-slate-200 pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className={strong ? "text-sm font-black text-slate-950" : "text-sm font-semibold text-slate-700"}>{value}</span>
    </div>
  );
}

function PreviewTextSection({ title, value }: { title: string; value: string | null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-slate-700">{value?.trim() || "-"}</p>
    </section>
  );
}
