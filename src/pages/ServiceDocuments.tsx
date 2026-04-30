import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Ban, Check, Copy, Edit, Eye, Plus, Printer, Search, Send, Trash2, X } from "lucide-react";
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
import { escapeHtml, escapeHtmlWithLineBreaks, openPrintWindow } from "@/lib/print";
import { serviceDb } from "@/features/services/db";
import { EMPTY_SERVICE_LINE, SERVICE_DOCUMENT_PREFIX, SERVICE_STATUS_LABEL } from "@/features/services/constants";
import { buildInitialServiceDocumentForm, canTransitionServiceDocument } from "@/features/services/logic";
import { calculateServiceLineTotal, useServiceDocumentMutations } from "@/features/services/hooks/useServiceDocumentMutations";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";
import type { ServiceDocument, ServiceDocumentEvent, ServiceDocumentForm, ServiceDocumentLine, ServiceDocumentStatus } from "@/features/services/types";

const STATUS_OPTIONS: Array<ServiceDocumentStatus | "ALL"> = ["ALL", "DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED"];

const SERVICE_STATUS_BADGE_CLASS: Record<ServiceDocumentStatus, string> = {
  DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  SENT: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  REJECTED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  CANCELLED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

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

  const { upsertMutation, duplicateMutation, transitionMutation } = useServiceDocumentMutations({
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
        return `Estado cambiado a ${SERVICE_STATUS_LABEL[(event.payload?.to as ServiceDocumentStatus | undefined) ?? "DRAFT"] ?? "actualizado"}`;
      case "DUPLICATED":
        return "Documento duplicado";
      case "CONVERTED_TO_REMITO":
        return "Convertido a remito";
      default:
        return "Evento";
    }
  };

  const canManageServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.create");
  const canEditServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.edit");
  const canApproveServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.approve");
  const canCancelServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.cancel");
  const canPrintServiceDocuments = companyRoleCodes.includes("admin") || companyPermissionCodes.includes("documents.print");

  const confirmAction = (message: string) => window.confirm(message);

  const openServicePrint = async (document: ServiceDocument) => {
    const win = openPrintWindow(`<!doctype html><html><head><title>Imprimiendo...</title><style>
      html,body{margin:0;padding:0;background:#fff}
      body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}
      </style></head><body>Preparando impresión...</body></html>`);
    const { data: lineRows } = await serviceDb
      .from("service_document_lines")
      .select("id, document_id, description, quantity, unit, unit_price, line_total, sort_order")
      .eq("document_id", document.id)
      .order("sort_order");
    const documentLines = (lineRows ?? []) as ServiceDocumentLine[];
    const title = `${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")}`;
    if (!win) return;
    win.document.open();
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
      <style>
      @page{size:A4 portrait;margin:10mm}
      html,body{margin:0;padding:0}
      body{font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc}
      .shell{width:190mm;max-width:190mm;margin:0 auto;padding:6mm 0}
      .sheet{border:1px solid #dbe3ee;border-radius:22px;padding:8mm;background:#fff;box-shadow:0 20px 60px rgba(15,23,42,.08)}
      .head{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;padding-bottom:16px;border-bottom:1px solid #dbe3ee}
      .brand{min-height:140px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#ffffff 0%,#f5f9ff 60%,#eef4ff 100%);border:1px solid #dbe7f5;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px}
      .eyebrow{display:inline-flex;width:max-content;border:1px solid #dbe3ee;border-radius:999px;background:#fff;padding:6px 12px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#475569}
      .brand-name{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:.04em}
      .muted{color:#475569;font-size:12px;margin:2px 0}
      .docbox{padding:18px;border-radius:18px;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f8fafc}
      .docbox h2{margin:0 0 10px 0;font-size:22px}
      .docline{font-size:12px;color:#dbeafe;margin:6px 0}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
      .meta-card{border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#fff}
      .meta-title{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 10px 0}
      .section{margin-top:16px;border:1px solid #e2e8f0;border-radius:18px;padding:14px;background:#fff}
      .section-title{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 10px 0;font-weight:700}
      table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;overflow:hidden;border:1px solid #dbe3ee;border-radius:16px}
      th,td{padding:10px 12px;font-size:12px;border-bottom:1px solid #e8eef5;vertical-align:top}
      th{background:#eef4f8;text-align:left;color:#334155}
      tbody tr:nth-child(even){background:#fbfdff}
      tbody tr:last-child td{border-bottom:none}
      .totals{display:flex;justify-content:flex-end;margin-top:16px}
      .totals-box{min-width:260px;border:1px solid #dbe3ee;background:linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%);border-radius:18px;padding:14px 16px}
      .totals-value{margin-top:6px;font-size:26px;font-weight:800;color:#0f172a}
      .text{white-space:pre-line;line-height:1.6;font-size:12px;color:#334155}
      .print-action{display:block;margin:16px auto 0;padding:10px 16px;border:none;border-radius:999px;background:#0f172a;color:#fff;cursor:pointer}
      @media print{body{background:#fff}.shell{width:190mm;max-width:190mm;padding:0}.sheet{border:none;box-shadow:none;border-radius:0;padding:0}.print-action{display:none}}
      </style></head><body><div class="shell"><div class="sheet">
      <div class="head">
        <div class="brand">
          <div>
            <span class="eyebrow">${escapeHtml(document.type === "REMITO" ? "Remito de servicio" : "Presupuesto de servicio")}</span>
            <p class="brand-name" style="margin:14px 0 0 0">${escapeHtml(settings.legal_name ?? settings.app_name)}</p>
            <p class="muted">${escapeHtml(settings.document_tagline ?? "Documentación comercial")}</p>
          </div>
          ${settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.app_name)}" style="max-height:72px;max-width:240px;object-fit:contain" />` : ""}
        </div>
        <div class="docbox">
          <h2>${escapeHtml(document.type === "REMITO" ? "Remito de servicio" : "Presupuesto de servicio")}</h2>
          <p class="docline"><strong>Nro:</strong> ${escapeHtml(title)}</p>
          <p class="docline"><strong>Fecha:</strong> ${formatIsoDate(document.issue_date)}</p>
          <p class="docline"><strong>Estado:</strong> ${escapeHtml(SERVICE_STATUS_LABEL[document.status])}</p>
          ${document.valid_until ? `<p class="docline"><strong>Vigencia:</strong> ${formatIsoDate(document.valid_until)}</p>` : ""}
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-card">
          <p class="meta-title">Cliente</p>
          <p class="muted"><strong>Cliente:</strong> ${escapeHtml(document.customers?.name ?? "Sin cliente")}</p>
          ${document.customers?.cuit ? `<p class="muted"><strong>CUIT:</strong> ${escapeHtml(document.customers.cuit)}</p>` : ""}
        </div>
        <div class="meta-card">
          <p class="meta-title">Operación</p>
          ${document.reference ? `<p class="muted"><strong>Referencia:</strong> ${escapeHtml(document.reference)}</p>` : ""}
          ${document.delivery_time ? `<p class="muted"><strong>Plazo de entrega:</strong> ${escapeHtml(document.delivery_time)}</p>` : ""}
          ${document.payment_terms ? `<p class="muted"><strong>Condiciones de pago:</strong> ${escapeHtml(document.payment_terms)}</p>` : ""}
          ${document.delivery_location ? `<p class="muted"><strong>Lugar de entrega:</strong> ${escapeHtml(document.delivery_location)}</p>` : ""}
        </div>
      </div>
      ${document.intro_text ? `<div class="section"><p class="section-title">Texto introductorio</p><div class="text">${escapeHtmlWithLineBreaks(document.intro_text)}</div></div>` : ""}
      <div class="section">
        <p class="section-title">Líneas</p>
        <table><thead><tr><th>Descripción</th><th style="width:72px;text-align:right">Cant.</th><th style="width:110px;text-align:right">Total</th></tr></thead>
        <tbody>${documentLines.map((line) => `<tr><td>${escapeHtml(line.description)}</td><td style="text-align:right">${Number(line.quantity ?? 0).toLocaleString("es-AR")}</td><td style="text-align:right">${currency.format(Number(line.line_total ?? 0))}</td></tr>`).join("")}</tbody></table>
        <div class="totals"><div class="totals-box"><div style="display:flex;justify-content:space-between;font-size:12px"><span>Subtotal</span><span>${currency.format(Number(document.subtotal ?? 0))}</span></div><div class="totals-value" style="display:flex;justify-content:space-between"><span>Total</span><span>${currency.format(Number(document.total ?? 0))}</span></div></div></div>
      </div>
      ${document.closing_text ? `<div class="section"><p class="section-title">Cierre</p><div class="text">${escapeHtmlWithLineBreaks(document.closing_text)}</div></div>` : ""}
      </div></div><button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button></body></html>`);
    win.document.close();
    win.focus();
  };

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
    if (document.status === "CANCELLED") {
      toast({ title: "No se puede duplicar", description: "Los documentos anulados no se pueden duplicar.", variant: "destructive" });
      return;
    }
    if (!confirmAction(`Duplicar el documento ${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")} ?`)) return;
    duplicateMutation.mutate(document.id);
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
                      <Badge variant="outline" className={SERVICE_STATUS_BADGE_CLASS[document.status]}>{SERVICE_STATUS_LABEL[document.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{currency.format(Number(document.total ?? 0))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canManageServiceDocuments && canTransitionServiceDocument(document, "SENT") ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-cyan-500 hover:text-cyan-400" title="Enviar" onClick={() => triggerTransition(document, "SENT")} disabled={transitionMutation.isPending}>
                            <Send className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canApproveServiceDocuments && canTransitionServiceDocument(document, "APPROVED") ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-emerald-500 hover:text-emerald-400" title="Aprobar" onClick={() => triggerTransition(document, "APPROVED")} disabled={transitionMutation.isPending}>
                            <Check className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canApproveServiceDocuments && canTransitionServiceDocument(document, "REJECTED") ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-rose-500 hover:text-rose-400" title="Rechazar" onClick={() => triggerTransition(document, "REJECTED")} disabled={transitionMutation.isPending}>
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canCancelServiceDocuments && canTransitionServiceDocument(document, "CANCELLED") ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-400" title="Anular" onClick={() => triggerTransition(document, "CANCELLED")} disabled={transitionMutation.isPending}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canManageServiceDocuments && document.status !== "CANCELLED" ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-violet-500 hover:text-violet-400" title="Duplicar" onClick={() => triggerDuplicate(document)} disabled={duplicateMutation.isPending}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-sky-500 hover:text-sky-400" title="Vista previa" onClick={() => openPreview(document)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canPrintServiceDocuments ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-400" title="Imprimir" onClick={() => void openServicePrint(document)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canEditServiceDocuments && document.status === "DRAFT" ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-400" title="Editar" onClick={() => openEdit(document)}>
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
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <DialogHeader>
            <div className="px-5 pt-5">
              <DialogTitle>{editingDocumentId ? "Editar presupuesto de servicio" : "Nuevo presupuesto de servicio"}</DialogTitle>
              <DialogDescription>Formulario de presupuesto de servicio manual.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="grid gap-3 px-5 pb-4">
            <section className="rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm">
              <div className="grid gap-2.5 md:grid-cols-5">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Cliente</Label>
                  <Select value={form.customer_id} onValueChange={(value) => setForm((current) => ({ ...current, customer_id: value }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                    <SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-1"><Label className="text-xs">Referencia</Label><Input className="h-9" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input className="h-9" type="date" value={form.issue_date} onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Vigencia</Label><Input className="h-9" type="date" value={form.valid_until} onChange={(event) => setForm((current) => ({ ...current, valid_until: event.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ServiceDocumentStatus }))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.filter((option) => option !== "ALL").map((option) => <SelectItem key={option} value={option}>{SERVICE_STATUS_LABEL[option]}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </section>

            <section className="grid gap-2 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm">
              <Label className="text-xs">Texto introductorio</Label>
              <Textarea className="min-h-14 resize-none text-sm" rows={2} value={form.intro_text} onChange={(event) => setForm((current) => ({ ...current, intro_text: event.target.value }))} />
              <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                  <TableHeader><TableRow className="h-9"><TableHead>Descripción</TableHead><TableHead className="w-24">Cantidad</TableHead><TableHead className="w-24">Unidad</TableHead><TableHead className="w-32">Precio</TableHead><TableHead className="w-32 text-right">Total</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>{lines.map((line, index) => (
                    <TableRow key={index} className="h-12">
                      <TableCell className="py-1.5"><Textarea className="min-h-12 resize-none text-sm" rows={2} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" type="number" min="0" step="0.001" value={line.quantity ?? ""} onChange={(event) => updateLine(index, { quantity: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" value={line.unit ?? ""} onChange={(event) => updateLine(index, { unit: event.target.value })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" type="number" min="0" step="0.01" value={line.unit_price ?? ""} onChange={(event) => updateLine(index, { unit_price: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="py-1.5 text-right text-sm font-semibold">{currency.format(calculateServiceLineTotal(line))}</TableCell>
                      <TableCell className="py-1.5"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLine(index)} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9 w-fit" onClick={() => setLines((current) => [...current, { ...EMPTY_SERVICE_LINE, sort_order: current.length + 1 }])}>
                <Plus className="mr-2 h-4 w-4" /> Agregar línea
              </Button>
            </section>

            <section className="grid gap-2.5 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm md:grid-cols-3">
              <div className="space-y-1"><Label className="text-xs">Plazo de entrega</Label><Textarea className="min-h-14 resize-none text-sm" rows={2} value={form.delivery_time} onChange={(event) => setForm((current) => ({ ...current, delivery_time: event.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Condiciones de pago</Label><Textarea className="min-h-14 resize-none text-sm" rows={2} value={form.payment_terms} onChange={(event) => setForm((current) => ({ ...current, payment_terms: event.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Lugar de entrega</Label><Textarea className="min-h-14 resize-none text-sm" rows={2} value={form.delivery_location} onChange={(event) => setForm((current) => ({ ...current, delivery_location: event.target.value }))} /></div>
            </section>

            <section className="grid gap-2 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm">
              <Label className="text-xs">Cierre</Label>
              <Textarea className="min-h-16 resize-none text-sm" rows={2} value={form.closing_text} onChange={(event) => setForm((current) => ({ ...current, closing_text: event.target.value }))} />
            </section>

            {selectedEvents.length > 0 ? (
              <section className="grid gap-2 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm">
                <Label className="text-xs">Historial</Label>
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
          <DialogFooter className="sticky bottom-0 z-10 flex-row items-center justify-between border-t bg-background/95 px-5 py-3 backdrop-blur">
            <div className="mr-auto">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Total documento</p>
              <p className="text-xl font-extrabold tracking-tight">{currency.format(total)}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" className="px-6" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Guardando..." : "Guardar"}</Button>
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
            <div className="grid flex-1 min-h-0 gap-3 2xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,430px)]">
              <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable]">
                <div className="space-y-3">
                  <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-primary/80 via-primary/35 to-transparent" />
                    <div className="border-b border-border/60 px-5 py-4 sm:px-6">
                      <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
                        <div className="rounded-2xl border border-border/60 bg-background/60 p-3.5 text-center">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <Badge variant="outline" className={SERVICE_STATUS_BADGE_CLASS[previewDocument.status]}>{SERVICE_STATUS_LABEL[previewDocument.status]}</Badge>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Documento</p>
                              <p className="mt-1 text-lg font-semibold text-foreground">{SERVICE_DOCUMENT_PREFIX}-{String(previewDocument.number).padStart(6, "0")}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-col items-center justify-center gap-2 border-t border-border/60 pt-4">
                            {settings.logo_url ? <img src={settings.logo_url} alt={settings.app_name} className="h-12 w-12 rounded-full object-contain" /> : null}
                            <div className="min-w-0">
                              <p className="text-xl font-semibold tracking-tight text-foreground">{settings.legal_name ?? settings.app_name}</p>
                              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{settings.document_tagline ?? "Documentación comercial"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3.5 text-foreground shadow-sm">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-primary">Servicio</p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight">{previewDocument.type === "REMITO" ? "Remito de servicio" : "Presupuesto de servicio"}</p>
                          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                            <p><span className="text-foreground/70">Fecha:</span> {formatIsoDate(previewDocument.issue_date)}</p>
                            <p><span className="text-foreground/70">Estado:</span> {SERVICE_STATUS_LABEL[previewDocument.status]}</p>
                            {previewDocument.valid_until ? <p><span className="text-foreground/70">Vigencia:</span> {formatIsoDate(previewDocument.valid_until)}</p> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)]">
                      <div className="border-b border-border/60 px-5 py-4 lg:border-b-0 lg:border-r sm:px-6">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cliente</p><p className="mt-1 text-sm font-semibold text-foreground">{previewDocument.customers?.name ?? "Sin cliente"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Referencia</p><p className="mt-1 text-sm text-foreground">{previewDocument.reference || "-"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Vigencia</p><p className="mt-1 text-sm text-foreground">{previewDocument.valid_until ? formatIsoDate(previewDocument.valid_until) : "-"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Estado</p><p className="mt-1 text-sm text-foreground">{SERVICE_STATUS_LABEL[previewDocument.status]}</p></div>
                        </div>
                      </div>
                      <div className="px-5 py-4 sm:px-6">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operación</p>
                        <div className="mt-3 space-y-1 text-sm leading-5">
                          {previewDocument.reference ? <p className="text-muted-foreground">Referencia: <span className="text-foreground">{previewDocument.reference}</span></p> : null}
                          {previewDocument.delivery_time ? <p className="text-muted-foreground">Plazo: <span className="text-foreground">{previewDocument.delivery_time}</span></p> : null}
                          {previewDocument.payment_terms ? <p className="text-muted-foreground">Pago: <span className="text-foreground">{previewDocument.payment_terms}</span></p> : null}
                          {previewDocument.delivery_location ? <p className="text-muted-foreground">Entrega: <span className="text-foreground">{previewDocument.delivery_location}</span></p> : null}
                          {previewDocument.type === "REMITO" && previewDocument.source_document_number_snapshot ? <p className="text-muted-foreground">Origen: <span className="text-foreground">{previewDocument.source_document_number_snapshot}</span></p> : null}
                        </div>
                      </div>
                    </div>
                  </section>
                  {previewDocument.intro_text ? (
                    <section className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Introducción</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/85">{previewDocument.intro_text}</p>
                    </section>
                  ) : null}
                  <section className="rounded-2xl border border-border/60 bg-card/90 p-2.5 shadow-sm">
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
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-background">
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
                  {previewDocument.closing_text ? (
                    <section className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Cierre</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/85">{previewDocument.closing_text}</p>
                    </section>
                  ) : null}
                </div>
              </div>
              <aside className="min-h-0 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable] 2xl:min-w-[380px]">
                <section className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Historial</p>
                  <p className="mt-1 text-sm text-muted-foreground">Trazabilidad del documento.</p>
                  {selectedEvents.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-3 py-5 text-center">
                      <p className="mt-1 text-sm font-medium text-muted-foreground">Sin eventos registrados</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedEvents.map((event, index) => (
                        <div key={event.id} className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5 rounded-xl border border-border/60 bg-background/80 p-3">
                          <div className="relative flex justify-center">
                            <div className="absolute top-0 bottom-0 w-px bg-border/70" />
                            <div className="relative mt-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
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
          <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
            <Button variant="outline" onClick={() => setPreviewDocumentId(null)}>Cerrar</Button>
            <Button type="button" onClick={() => void openServicePrint(previewDocument)}>Abrir impresión</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
