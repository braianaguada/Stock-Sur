import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, Copy, Edit, Eye, Plus, Printer, Search, Slash, Send, Trash2, Truck, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { currency, formatIsoDate } from "@/lib/formatters";
import { EMPTY_SERVICE_LINE, SERVICE_DOCUMENT_PREFIX, SERVICE_STATUS_LABEL } from "@/features/services/constants";
import { buildInitialServiceDocumentForm, canConvertServiceDocumentToRemito, canTransitionServiceDocument } from "@/features/services/logic";
import { calculateServiceLineTotal, useServiceDocumentMutations } from "@/features/services/hooks/useServiceDocumentMutations";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";
import type { ServiceDocument, ServiceDocumentEvent, ServiceDocumentForm, ServiceDocumentLine, ServiceDocumentStatus } from "@/features/services/types";

const STATUS_OPTIONS: Array<ServiceDocumentStatus | "ALL"> = ["ALL", "DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED"];

export default function ServiceDocumentsPage() {
  const { currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
  const { settings } = useCompanyBrand();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<ServiceDocumentStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceDocumentForm>(() => buildInitialServiceDocumentForm(settings));
  const [lines, setLines] = useState<ServiceDocumentLine[]>([{ ...EMPTY_SERVICE_LINE }]);

  const { customers, documents, selectedDocument, selectedLines, selectedEvents, isLoading } = useServiceDocuments({
    companyId: currentCompany?.id ?? null,
    search: deferredSearch,
    status,
    documentId: editingDocumentId ?? previewDocumentId,
  });

  const total = useMemo(() => lines.reduce((sum, line) => sum + calculateServiceLineTotal(line), 0), [lines]);

  useEffect(() => {
    if (!selectedDocument || !editingDocumentId) return;
    setForm({
      customer_id: selectedDocument.customer_id ?? "",
      status: selectedDocument.status,
      reference: selectedDocument.reference ?? "",
      issue_date: selectedDocument.issue_date,
      valid_until: selectedDocument.valid_until ?? "",
      intro_text: selectedDocument.intro_text ?? "",
      delivery_time: selectedDocument.delivery_time ?? "",
      payment_terms: selectedDocument.payment_terms ?? "",
      delivery_location: selectedDocument.delivery_location ?? "",
      closing_text: selectedDocument.closing_text ?? "",
      currency: selectedDocument.currency ?? "ARS",
    });
    setLines(selectedLines.length > 0 ? selectedLines : [{ ...EMPTY_SERVICE_LINE }]);
  }, [editingDocumentId, selectedDocument, selectedLines]);

  const resetForm = () => {
    setEditingDocumentId(null);
    setForm(buildInitialServiceDocumentForm(settings));
    setLines([{ ...EMPTY_SERVICE_LINE }]);
  };

  const { upsertMutation, duplicateMutation, convertToRemitoMutation, transitionMutation } = useServiceDocumentMutations({
    companyId: currentCompany?.id ?? null,
    editingDocumentId,
    form,
    lines,
    toast,
    onDone: () => {
      setDialogOpen(false);
      resetForm();
    },
  });

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openPreview = (document: ServiceDocument) => {
    setPreviewDocumentId(document.id);
  };

  const openEdit = (document: ServiceDocument) => {
    if (document.status !== "DRAFT") return;
    setEditingDocumentId(document.id);
    setDialogOpen(true);
  };

  const describeEvent = (event: ServiceDocumentEvent) => {
    switch (event.event_type) {
      case "CREATED":
        return "Documento creado";
      case "UPDATED":
        return "Documento actualizado";
      case "STATUS_CHANGED":
        return `Estado cambiado a ${(event.payload?.to as string | undefined) ?? "actualizado"}`;
      case "DUPLICATED":
        return "Documento duplicado";
      case "CONVERTED_TO_REMITO":
        return "Convertido a remito";
      default:
        return event.event_type.replaceAll("_", " ");
    }
  };

  const canManageServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.create");
  const canEditServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.edit");
  const canApproveServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.approve");
  const canCancelServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.cancel");
  const canPrintServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.print");

  const confirmAction = (message: string) => window.confirm(message);

  const triggerTransition = (document: ServiceDocument, targetStatus: ServiceDocumentStatus) => {
    const labels: Record<ServiceDocumentStatus, string> = {
      DRAFT: "Borrador",
      SENT: "Enviado",
      APPROVED: "Aprobado",
      REJECTED: "Rechazado",
      CANCELLED: "Anulado",
    };
    if (!confirmAction(`Cambiar el documento ${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")} a ${labels[targetStatus]}?`)) return;
    transitionMutation.mutate({ documentId: document.id, targetStatus });
  };

  const triggerDuplicate = (document: ServiceDocument) => {
    if (!confirmAction(`Duplicar el documento ${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")} ?`)) return;
    duplicateMutation.mutate(document.id);
  };

  const triggerRemito = (document: ServiceDocument) => {
    if (!confirmAction(`Convertir el documento ${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")} en remito de servicio?`)) return;
    convertToRemitoMutation.mutate(document.id);
  };

  const updateLine = (index: number, patch: Partial<ServiceDocumentLine>) => {
    setLines((previous) =>
      previous.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        return { ...next, line_total: calculateServiceLineTotal(next) };
      }),
    );
  };

  const removeLine = (index: number) => {
    setLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index));
  };

  const previewDocument = selectedDocument ?? null;
  const previewLines = selectedLines;

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Necesitas una empresa activa para crear presupuestos de servicio." /> : null}

        <PageHeader
          eyebrow="Servicios"
          title="Documentos"
          subtitle="Presupuestos de servicio manuales, separados de stock, caja e items."
          actions={
            <Button onClick={openCreate} disabled={!canManageServiceDocuments}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto
            </Button>
          }
        />

        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente, numero o referencia..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="w-full md:w-56">
            <Select value={status} onValueChange={(value) => setStatus(value as ServiceDocumentStatus | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "ALL" ? "Todos" : SERVICE_STATUS_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <section className="data-panel overflow-hidden">
          {isLoading ? (
            <div className="grid gap-3 p-6">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
              <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
              <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
            </div>
          ) : documents.length === 0 ? (
            <Card className="m-4 border-dashed bg-muted/15">
              <CardContent className="flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">Todavía no hay presupuestos de servicio</h3>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Creá el primero para empezar a registrar trabajos manuales sin tocar stock, caja ni cuenta corriente.
                  </p>
                </div>
                <Button onClick={openCreate} disabled={!canManageServiceDocuments}>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">{SERVICE_DOCUMENT_PREFIX}-{String(document.number).padStart(6, "0")}</TableCell>
                    <TableCell>{document.customers?.name ?? "Sin cliente"}</TableCell>
                    <TableCell>{formatIsoDate(document.issue_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{SERVICE_STATUS_LABEL[document.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{currency.format(Number(document.total ?? 0))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canManageServiceDocuments && canTransitionServiceDocument(document, "SENT") ? (
                          <Button type="button" variant="ghost" size="icon" title="Enviar" onClick={() => triggerTransition(document, "SENT")} disabled={transitionMutation.isPending}>
                            <Send className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canApproveServiceDocuments && canTransitionServiceDocument(document, "APPROVED") ? (
                          <Button type="button" variant="ghost" size="icon" title="Aprobar" onClick={() => triggerTransition(document, "APPROVED")} disabled={transitionMutation.isPending}>
                            <Check className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canApproveServiceDocuments && canTransitionServiceDocument(document, "REJECTED") ? (
                          <Button type="button" variant="ghost" size="icon" title="Rechazar" onClick={() => triggerTransition(document, "REJECTED")} disabled={transitionMutation.isPending}>
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canCancelServiceDocuments && canTransitionServiceDocument(document, "CANCELLED") ? (
                          <Button type="button" variant="ghost" size="icon" title="Anular" onClick={() => triggerTransition(document, "CANCELLED")} disabled={transitionMutation.isPending}>
                            <Slash className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canManageServiceDocuments && canConvertServiceDocumentToRemito(document) ? (
                          <Button type="button" variant="ghost" size="icon" title="Convertir a remito" onClick={() => triggerRemito(document)} disabled={convertToRemitoMutation.isPending}>
                            <Truck className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canManageServiceDocuments ? (
                          <Button type="button" variant="ghost" size="icon" title="Duplicar" onClick={() => triggerDuplicate(document)} disabled={duplicateMutation.isPending}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button type="button" variant="ghost" size="icon" title="Vista previa" onClick={() => openPreview(document)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canPrintServiceDocuments ? (
                          <Button type="button" variant="ghost" size="icon" title="Imprimir" onClick={() => window.open(`/print/service-document/${document.id}`, "_blank", "noopener,noreferrer")}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canEditServiceDocuments && document.status === "DRAFT" ? (
                          <Button type="button" variant="ghost" size="icon" title="Editar" onClick={() => openEdit(document)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDocumentId ? "Editar presupuesto de servicio" : "Nuevo presupuesto de servicio"}</DialogTitle>
            <DialogDescription>Formulario de presupuesto de servicio manual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6">
            <section className="grid gap-4 rounded-xl border bg-muted/10 p-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <Label>Cliente</Label>
                <Select value={form.customer_id} onValueChange={(value) => setForm((current) => ({ ...current, customer_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1"><Label>Referencia</Label><Input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></div>
              <div><Label>Fecha</Label><Input type="date" value={form.issue_date} onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))} /></div>
              <div><Label>Vigencia</Label><Input type="date" value={form.valid_until} onChange={(event) => setForm((current) => ({ ...current, valid_until: event.target.value }))} /></div>
              <div><Label>Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ServiceDocumentStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.filter((option) => option !== "ALL").map((option) => <SelectItem key={option} value={option}>{SERVICE_STATUS_LABEL[option]}</SelectItem>)}</SelectContent></Select></div>
            </section>
            <section className="grid gap-4 rounded-xl border bg-muted/10 p-4">
              <Label>Texto introductorio</Label>
              <Textarea rows={3} value={form.intro_text} onChange={(event) => setForm((current) => ({ ...current, intro_text: event.target.value }))} />
              <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                  <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead className="w-28">Cantidad</TableHead><TableHead className="w-28">Unidad</TableHead><TableHead className="w-36">Precio</TableHead><TableHead className="w-36 text-right">Total</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                  <TableBody>{lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell><Textarea rows={2} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></TableCell>
                      <TableCell><Input type="number" min="0" step="0.001" value={line.quantity ?? ""} onChange={(event) => updateLine(index, { quantity: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell><Input value={line.unit ?? ""} onChange={(event) => updateLine(index, { unit: event.target.value })} /></TableCell>
                      <TableCell><Input type="number" min="0" step="0.01" value={line.unit_price ?? ""} onChange={(event) => updateLine(index, { unit_price: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="text-right">{currency.format(calculateServiceLineTotal(line))}</TableCell>
                      <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" className="w-fit" onClick={() => setLines((current) => [...current, { ...EMPTY_SERVICE_LINE, sort_order: current.length + 1 }])}>
                <Plus className="mr-2 h-4 w-4" /> Agregar línea
              </Button>
            </section>
            <section className="grid gap-4 rounded-xl border bg-muted/10 p-4 md:grid-cols-3">
              <div><Label>Plazo de entrega</Label><Textarea rows={3} value={form.delivery_time} onChange={(event) => setForm((current) => ({ ...current, delivery_time: event.target.value }))} /></div>
              <div><Label>Condiciones de pago</Label><Textarea rows={3} value={form.payment_terms} onChange={(event) => setForm((current) => ({ ...current, payment_terms: event.target.value }))} /></div>
              <div><Label>Lugar de entrega</Label><Textarea rows={3} value={form.delivery_location} onChange={(event) => setForm((current) => ({ ...current, delivery_location: event.target.value }))} /></div>
            </section>
            <section className="grid gap-4 rounded-xl border bg-muted/10 p-4">
              <Label>Cierre</Label>
              <Textarea rows={3} value={form.closing_text} onChange={(event) => setForm((current) => ({ ...current, closing_text: event.target.value }))} />
              <div className="ml-auto w-full max-w-sm rounded-lg border bg-background p-4 shadow-sm">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{currency.format(total)}</span></div>
                <div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span>{currency.format(total)}</span></div>
              </div>
            </section>
            {selectedEvents.length > 0 ? (
              <section className="grid gap-3 rounded-xl border bg-muted/10 p-4">
                <Label>Historial</Label>
                <div className="grid gap-2">
                  {selectedEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{describeEvent(event)}</div>
                        <div className="text-muted-foreground">
                          {new Date(event.created_at).toLocaleString("es-AR")}
                          {event.created_by ? ` · ${event.created_by.slice(0, 8)}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewDocumentId)} onOpenChange={(open) => { if (!open) setPreviewDocumentId(null); }}>
        <DialogContent className="flex h-[min(92vh,920px)] max-w-[min(97vw,1520px)] flex-col overflow-hidden border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">Vista previa del presupuesto de servicio</DialogTitle>
            <DialogDescription>Documento de servicio y trazabilidad.</DialogDescription>
          </DialogHeader>
          {previewDocument ? (
            <div className="grid flex-1 min-h-0 gap-4 2xl:grid-cols-[minmax(0,1.95fr)_minmax(380px,460px)]">
              <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable]">
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-primary/80 via-primary/35 to-transparent" />
                    <div className="border-b border-border/60 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Badge variant="outline">{SERVICE_STATUS_LABEL[previewDocument.status]}</Badge>
                          <div className="mt-3">
                            <p className="text-2xl font-semibold tracking-tight text-foreground">{previewDocument.customers?.name ?? "Sin cliente"}</p>
                            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Presupuesto de servicio</p>
                          </div>
                        </div>
                        <div className="min-w-[180px] border-l border-border/60 pl-4 text-right">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Documento</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{SERVICE_DOCUMENT_PREFIX}-{String(previewDocument.number).padStart(6, "0")}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{formatIsoDate(previewDocument.issue_date)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                      <div className="border-b border-border/60 px-5 py-4 lg:border-b-0 lg:border-r sm:px-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cliente</p><p className="mt-1 text-base font-semibold text-foreground">{previewDocument.customers?.name ?? "Sin cliente"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Referencia</p><p className="mt-1 text-sm text-foreground">{previewDocument.reference || "-"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Vigencia</p><p className="mt-1 text-sm text-foreground">{previewDocument.valid_until ? formatIsoDate(previewDocument.valid_until) : "-"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Estado</p><p className="mt-1 text-sm text-foreground">{SERVICE_STATUS_LABEL[previewDocument.status]}</p></div>
                        </div>
                      </div>
                      <div className="px-5 py-4 sm:px-6">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operación</p>
                        <div className="mt-3 space-y-1.5 text-sm">
                          {previewDocument.delivery_time ? <p className="text-muted-foreground">Plazo: <span className="text-foreground">{previewDocument.delivery_time}</span></p> : null}
                          {previewDocument.payment_terms ? <p className="text-muted-foreground">Pago: <span className="text-foreground">{previewDocument.payment_terms}</span></p> : null}
                          {previewDocument.delivery_location ? <p className="text-muted-foreground">Entrega: <span className="text-foreground">{previewDocument.delivery_location}</span></p> : null}
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Líneas</p>
                        <p className="mt-1 text-sm text-muted-foreground">Detalle principal del documento.</p>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total del documento</p>
                        <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{currency.format(Number(previewDocument.total ?? 0))}</p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-28 text-right">Cantidad</TableHead>
                            <TableHead className="w-32 text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewLines.map((line) => (
                            <TableRow key={line.id ?? `${line.sort_order}-${line.description}`}>
                              <TableCell>{line.description}</TableCell>
                              <TableCell className="text-right">{line.quantity ?? "-"}</TableCell>
                              <TableCell className="text-right">{currency.format(Number(line.line_total ?? 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </div>
              </div>
              <aside className="min-h-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable] 2xl:min-w-[380px]">
                <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Historial</p>
                  <p className="mt-1 text-sm text-muted-foreground">Trazabilidad del documento.</p>
                  {selectedEvents.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                        <p className="mt-1 text-sm font-medium text-muted-foreground">Sin eventos registrados</p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {selectedEvents.map((event, index) => (
                        <div key={event.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3 rounded-xl border border-border/60 bg-background/80 p-4">
                          <div className="relative flex justify-center">
                            <div className="absolute top-0 bottom-0 w-px bg-border/70" />
                            <div className="relative mt-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                              <span className="h-2 w-2 rounded-full bg-slate-500" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-5 text-foreground">{describeEvent(event)}</p>
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">
                              {new Date(event.created_at).toLocaleString("es-AR")}
                              {event.created_by ? ` · ${event.created_by.slice(0, 8)}` : ""}
                            </p>
                            {index === 0 ? <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-semibold">Más reciente</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No se pudo cargar la vista previa.</div>
          )}
          <div className="flex justify-end gap-2 px-5 pb-5">
            <Button variant="outline" onClick={() => setPreviewDocumentId(null)}>Cerrar</Button>
            <Button type="button" onClick={() => window.open(`/print/service-document/${previewDocument.id}`, "_blank", "noopener,noreferrer")}>Abrir impresión</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
