import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CompanySettings } from "@/contexts/company-brand-context";
import { SERVICE_DOCUMENT_PREFIX, SERVICE_STATUS_LABEL } from "@/features/services/constants";
import type { ServiceDocument, ServiceDocumentEvent, ServiceDocumentLine, ServiceDocumentStatus } from "@/features/services/types";
import { currency, formatIsoDate } from "@/lib/formatters";

type ServiceDocumentPreviewDialogProps = {
  open: boolean;
  onClose: () => void;
  previewDocument: ServiceDocument | null;
  previewLines: ServiceDocumentLine[];
  selectedEvents: ServiceDocumentEvent[];
  settings: CompanySettings;
  describeEvent: (event: ServiceDocumentEvent) => string;
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

const formatDocumentNumber = (document: ServiceDocument) =>
  `${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")}`;

export function ServiceDocumentPreviewDialog({
  open,
  onClose,
  previewDocument,
  previewLines,
  selectedEvents,
  settings,
  describeEvent,
  onOpenPrint,
}: ServiceDocumentPreviewDialogProps) {
  const documentTitle = previewDocument?.type === "REMITO" ? "Remito de servicio" : "Presupuesto de servicio";
  const previewTitle = previewDocument?.type === "REMITO"
    ? "Vista previa del remito de servicio"
    : "Vista previa del presupuesto de servicio";
  const brandName = settings.app_name || settings.legal_name || "Stock Sur";
  const legalName = settings.legal_name || brandName;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex h-[min(94vh,960px)] max-w-[min(97vw,1540px)] flex-col overflow-hidden border-slate-300/80 bg-slate-200/95 p-0 shadow-2xl backdrop-blur-xl">
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
                    <div className="flex h-24 w-40 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt={brandName} className="max-h-full max-w-full object-contain" />
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
                            <TableHead className="h-9 w-28 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-300">P. unit.</TableHead>
                            <TableHead className="h-9 w-28 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-300">Total</TableHead>
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
                                <TableCell className="py-2 text-right text-sm text-slate-700">{currency.format(Number(line.unit_price ?? 0))}</TableCell>
                                <TableCell className="py-2 text-right text-sm font-black text-slate-950">{currency.format(Number(line.line_total ?? 0))}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">Sin trabajos cargados</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </section>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <PreviewTextSection title="Cierre" value={previewDocument.closing_text} />
                    <div className={`self-start rounded-2xl border border-slate-200 border-t-4 bg-slate-50 p-4 ${SERVICE_PREVIEW_TOTAL_ACCENT_CLASS[previewDocument.type]}`}>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-950">{currency.format(Number(previewDocument.subtotal ?? previewDocument.total ?? 0))}</span>
                      </div>
                      <div className="pt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total servicio</p>
                        <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{currency.format(Number(previewDocument.total ?? 0))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Historial</p>
                <p className="mt-1 text-sm text-slate-500">Trazabilidad del documento.</p>
                {selectedEvents.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center">
                    <p className="text-sm font-semibold text-slate-500">Sin eventos registrados</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {selectedEvents.map((event, index) => (
                      <div key={event.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="relative flex justify-center">
                          <div className="absolute top-2 bottom-0 w-px bg-slate-300" />
                          <span className="relative mt-1 h-3 w-3 rounded-full bg-slate-950 shadow-[0_0_0_4px_rgba(15,23,42,0.10)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-5 text-slate-950">{describeEvent(event)}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {new Date(event.created_at).toLocaleString("es-AR")}
                            {event.created_by ? ` - ${event.created_by.slice(0, 8)}` : ""}
                          </p>
                          {index === 0 ? <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Mas reciente</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">No se pudo cargar la vista previa.</div>
        )}

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-300/70 bg-white px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
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
