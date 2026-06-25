import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Ban, Bot, Check, Copy, Download, Eye, ImagePlus, Link2, Mail, MessageCircle, Pencil, Plus, Printer, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
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
import { getErrorMessage } from "@/lib/errors";
import { formatIsoDate, formatMoney } from "@/lib/formatters";
import { openPrintWindow, withPrintDialogOnLoad } from "@/lib/print";
import { serviceDb } from "@/features/services/db";
import { ServiceQuoteAiAssistantDialog } from "@/features/services/components/ServiceQuoteAiAssistantDialog";
import { ServiceDocumentPreviewDialog } from "@/features/services/components/ServiceDocumentPreviewDialog";
import { EMPTY_SERVICE_LINE, SERVICE_DOCUMENT_PREFIX, SERVICE_STATUS_LABEL } from "@/features/services/constants";
import { applyAiSuggestionToServiceDraft } from "@/features/services/aiAssistant";
import { buildInitialServiceDocumentForm, canTransitionServiceDocument } from "@/features/services/logic";
import { calculateServiceLineTotal, useServiceDocumentMutations } from "@/features/services/hooks/useServiceDocumentMutations";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";
import { buildServiceDocumentPrintHtml } from "@/features/services/print";
import { fetchBnaOfficialUsdRate, getManualExchangeRateSnapshot } from "@/features/services/exchangeRateProvider";
import { buildMailtoUrl, buildPublicServiceDocumentUrl, buildServiceDocumentShareMessage, buildWhatsAppUrl } from "@/features/services/share";
import type { ServiceQuoteAiApplyMode, ServiceQuoteAiSuggestion } from "@/features/services/aiAssistant";
import type { ServiceDocument, ServiceDocumentAttachment, ServiceDocumentAttachmentDraft, ServiceDocumentEvent, ServiceDocumentForm, ServiceDocumentLine, ServiceDocumentShareLink, ServiceDocumentStatus } from "@/features/services/types";

const STATUS_OPTIONS: Array<ServiceDocumentStatus | "ALL"> = ["ALL", "DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED"];
const ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SERVICE_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

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
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceDocumentForm>(() => buildInitialServiceDocumentForm(settings));
  const [lines, setLines] = useState<ServiceDocumentLine[]>([{ ...EMPTY_SERVICE_LINE }]);
  const [attachments, setAttachments] = useState<ServiceDocumentAttachmentDraft[]>([]);
  const [shareDocument, setShareDocument] = useState<ServiceDocument | null>(null);
  const [shareLink, setShareLink] = useState<ServiceDocumentShareLink | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareSubject, setShareSubject] = useState("");
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [pendingAiSuggestionId, setPendingAiSuggestionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof SERVICE_PAGE_SIZE_OPTIONS)[number]>(10);

  const { customers, documents, selectedDocument, selectedLines, selectedAttachments, selectedEvents, eventUserNamesById, isLoading } = useServiceDocuments({
    companyId: currentCompany?.id ?? null,
    search: deferredSearch,
    status,
    customerId: customerFilter,
    documentId: editingDocumentId ?? previewDocumentId,
  });

  const total = useMemo(() => {
    if (form.pricing_mode === "GLOBAL_TOTAL") return Number(form.global_total || 0);
    return lines.reduce((sum, line) => sum + calculateServiceLineTotal(line), 0);
  }, [form.global_total, form.pricing_mode, lines]);
  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedDocuments = useMemo(
    () => documents.slice((safePage - 1) * pageSize, safePage * pageSize),
    [documents, pageSize, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, status, customerFilter, pageSize]);

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
      exchange_rate_source: selectedDocument.exchange_rate_source ?? "BNA",
      exchange_rate: selectedDocument.exchange_rate != null ? String(selectedDocument.exchange_rate) : "",
      exchange_rate_date: selectedDocument.exchange_rate_date ?? "",
      exchange_rate_fetched_at: selectedDocument.exchange_rate_fetched_at ?? "",
      exchange_rate_snapshot_label: selectedDocument.exchange_rate_snapshot_label ?? "",
      show_exchange_rate_note: selectedDocument.show_exchange_rate_note ?? true,
      pricing_mode: selectedDocument.pricing_mode ?? "DETAILED",
      global_total: selectedDocument.global_total != null ? String(selectedDocument.global_total) : "",
      hide_line_prices: selectedDocument.hide_line_prices ?? false,
    });
    setLines(selectedLines.length > 0 ? selectedLines : [{ ...EMPTY_SERVICE_LINE }]);
  }, [editingDocumentId, selectedDocument, selectedLines]);

  useEffect(() => {
    if (!editingDocumentId) return;
    setAttachments(selectedAttachments.map((attachment) => ({
      id: attachment.id,
      previewUrl: attachment.signed_url ?? "",
      storage_path: attachment.storage_path,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes ?? 0,
      title: attachment.title ?? "",
      description: attachment.description ?? "",
      sort_order: attachment.sort_order,
      include_in_print: attachment.include_in_print,
    })));
  }, [editingDocumentId, selectedAttachments]);

  const resetForm = () => {
    setEditingDocumentId(null);
    setForm(buildInitialServiceDocumentForm(settings));
    setLines([{ ...EMPTY_SERVICE_LINE }]);
    setAttachments([]);
    setPendingAiSuggestionId(null);
  };

  const { upsertMutation, duplicateMutation, transitionMutation } = useServiceDocumentMutations({
    companyId: currentCompany?.id ?? null,
    editingDocumentId,
    form,
    lines,
    attachments,
    toast,
    onDone: async (savedDocument) => {
      if (pendingAiSuggestionId && savedDocument?.id) {
        const { error } = await serviceDb
          .from("service_document_ai_suggestions")
          .update({
            accepted: true,
            accepted_at: new Date().toISOString(),
            service_document_id: savedDocument.id,
          })
          .eq("id", pendingAiSuggestionId);
        if (error) throw error;
        setPendingAiSuggestionId(null);
      }
      setDialogOpen(false);
      resetForm();
    },
  });

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openAiAssistantForNewDocument = () => {
    resetForm();
    setAiAssistantOpen(true);
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
    const { data: attachmentRows } = await serviceDb
      .from("service_document_attachments")
      .select("*")
      .eq("service_document_id", document.id)
      .eq("include_in_print", true)
      .order("sort_order");
    const documentLines = (lineRows ?? []) as ServiceDocumentLine[];
    const documentAttachments = await Promise.all(((attachmentRows ?? []) as ServiceDocumentAttachment[]).map(async (attachment) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 60 * 30);
      return { ...attachment, signed_url: data?.signedUrl ?? null };
    }));
    if (!win) return;
    win.document.open();
    win.document.write(buildServiceDocumentPrintHtml({ document, lines: documentLines, attachments: documentAttachments, companySettings: settings }));
    win.document.close();
    win.focus();
  };

  const downloadServicePdf = async (document: ServiceDocument) => {
    const win = openPrintWindow(`<!doctype html><html><head><title>Preparando PDF...</title><style>
      html,body{margin:0;padding:0;background:#fff}
      body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}
      </style></head><body>Preparando documento para guardar como PDF...</body></html>`);
    if (!win) {
      toast({ title: "No se pudo abrir el documento", description: "Habilitá las ventanas emergentes para imprimir o guardar el PDF.", variant: "destructive" });
      return;
    }
    setDownloadingDocumentId(document.id);
    try {
      const [{ data: lineRows, error: linesError }, { data: attachmentRows, error: attachmentsError }] = await Promise.all([
        serviceDb.from("service_document_lines").select("id, document_id, description, quantity, unit, unit_price, line_total, sort_order").eq("document_id", document.id).order("sort_order"),
        serviceDb.from("service_document_attachments").select("*").eq("service_document_id", document.id).eq("include_in_print", true).order("sort_order"),
      ]);
      if (linesError) throw linesError;
      if (attachmentsError) throw attachmentsError;
      const documentAttachments = await Promise.all(((attachmentRows ?? []) as ServiceDocumentAttachment[]).map(async (attachment) => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 60 * 30);
        return { ...attachment, signed_url: data?.signedUrl ?? null };
      }));
      const html = buildServiceDocumentPrintHtml({
        document,
        lines: (lineRows ?? []) as ServiceDocumentLine[],
        attachments: documentAttachments,
        companySettings: settings,
      });
      win.document.open();
      win.document.write(withPrintDialogOnLoad(html));
      win.document.close();
      win.focus();
    } catch (error) {
      win.close();
      toast({ title: "No se pudo descargar el PDF", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setDownloadingDocumentId(null);
    }
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

  const applyAiSuggestion = (params: {
    suggestion: ServiceQuoteAiSuggestion;
    suggestionId: string | null;
    mode: ServiceQuoteAiApplyMode;
    customerId: string;
  }) => {
    const hasExistingLines = lines.some((line) => line.description.trim());
    const shouldAppend = editingDocumentId && hasExistingLines && params.mode !== "price"
      ? confirmAction("Este presupuesto ya tiene lineas. Queres agregar las lineas sugeridas sin reemplazar las existentes?")
      : true;
    const result = applyAiSuggestionToServiceDraft({
      form: { ...form, customer_id: params.customerId || form.customer_id },
      lines,
      suggestion: params.suggestion,
      mode: params.mode,
      appendLines: shouldAppend,
    });
    setForm(result.form);
    setLines(result.lines);
    setPendingAiSuggestionId(params.suggestionId);
    setDialogOpen(true);
    toast({
      title: "Propuesta IA aplicada",
      description: "Revisala y guardala como presupuesto de servicio en borrador.",
    });
  };

  const fetchExchangeRate = async () => {
    setExchangeRateLoading(true);
    try {
      const snapshot = await fetchBnaOfficialUsdRate();
      setForm((current) => ({
        ...current,
        currency: "USD",
        exchange_rate_source: snapshot.source,
        exchange_rate: String(snapshot.rate),
        exchange_rate_date: snapshot.rateDate,
        exchange_rate_fetched_at: snapshot.fetchedAt,
        exchange_rate_snapshot_label: snapshot.label,
      }));
      toast({ title: "Cotizacion actualizada", description: "Se guardara como snapshot del presupuesto." });
    } catch (error) {
      toast({
        title: "No se pudo obtener la cotización automáticamente. Cargala manualmente.",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setExchangeRateLoading(false);
    }
  };

  const applyManualExchangeRate = (value: string) => {
    setForm((current) => {
      const rate = Number(value);
      const snapshot = Number.isFinite(rate) && rate > 0 ? getManualExchangeRateSnapshot(rate, current.exchange_rate_date || undefined) : null;
      return {
        ...current,
        exchange_rate: value,
        exchange_rate_source: snapshot ? "MANUAL" : current.exchange_rate_source,
        exchange_rate_date: snapshot?.rateDate ?? current.exchange_rate_date,
        exchange_rate_fetched_at: snapshot?.fetchedAt ?? current.exchange_rate_fetched_at,
        exchange_rate_snapshot_label: snapshot?.label ?? current.exchange_rate_snapshot_label,
      };
    });
  };

  const addAttachments = (files: FileList | null) => {
    if (!files) return;
    const accepted: ServiceDocumentAttachmentDraft[] = [];
    for (const file of Array.from(files)) {
      if (!ATTACHMENT_MIME_TYPES.includes(file.type)) {
        toast({ title: "Imagen no permitida", description: `${file.name} debe ser JPG, PNG o WEBP.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast({ title: "Imagen demasiado grande", description: `${file.name} supera 10 MB.`, variant: "destructive" });
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        title: "",
        description: "",
        sort_order: attachments.length + accepted.length + 1,
        include_in_print: true,
      });
    }
    if (accepted.length) setAttachments((current) => [...current, ...accepted]);
  };

  const updateAttachment = (id: string, patch: Partial<ServiceDocumentAttachmentDraft>) => {
    setAttachments((current) => current.map((attachment) => attachment.id === id ? { ...attachment, ...patch } : attachment));
  };

  const moveAttachment = (id: string, direction: -1 | 1) => {
    setAttachments((current) => {
      const visible = current.filter((attachment) => !attachment.remove);
      const index = visible.findIndex((attachment) => attachment.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= visible.length) return current;
      const reordered = [...visible];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      const orderById = new Map(reordered.map((attachment, order) => [attachment.id, order + 1]));
      return current.map((attachment) => ({ ...attachment, sort_order: orderById.get(attachment.id) ?? attachment.sort_order }));
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.map((attachment) => attachment.id === id ? { ...attachment, remove: true } : attachment));
  };

  const openShare = async (document: ServiceDocument) => {
    setShareDocument(document);
    setShareLink(null);
    setShareSubject(`Presupuesto de servicio N° SERV-${String(document.number).padStart(6, "0")}`);
    setShareMessage("");
    setShareEmail(document.customers?.email ?? "");
    setWhatsAppPhone(document.customers?.phone ?? "");
    setShareLinkLoading(true);
    try {
      const { data, error } = await serviceDb
        .from("service_document_share_links")
        .select("*")
        .eq("service_document_id", document.id)
        .eq("enabled", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const activeLink = ((data ?? []) as ServiceDocumentShareLink[])[0] ?? null;
      const publicLink = activeLink ? buildPublicServiceDocumentUrl(activeLink.token) : "";
      setShareLink(activeLink);
      setShareMessage(activeLink ? buildServiceDocumentShareMessage(document, publicLink) : "");
    } catch (error) {
      toast({
        title: "No se pudo consultar el link",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setShareLinkLoading(false);
    }
  };

  const ensureShareLink = async () => {
    if (!shareDocument) return null;
    if (shareLink?.enabled) return shareLink;
    setShareLinkLoading(true);
    try {
      const { data, error } = await serviceDb.rpc("create_service_document_share_link", {
        p_service_document_id: shareDocument.id,
        p_expires_at: null,
      });
      if (error) throw error;
      const link = data as ServiceDocumentShareLink;
      const publicLink = buildPublicServiceDocumentUrl(link.token);
      const message = buildServiceDocumentShareMessage(shareDocument, publicLink);
      setShareLink(link);
      setShareMessage(message);
      return link;
    } catch (error) {
      toast({
        title: "No se pudo generar el link",
        description: "No se pudo crear el link público. Probá de nuevo antes de compartir el presupuesto.",
        variant: "destructive",
      });
      console.error("Failed to create service document share link", error);
      return null;
    } finally {
      setShareLinkLoading(false);
    }
  };

  const getShareMessageWithLink = async () => {
    if (!shareDocument) return null;
    const link = await ensureShareLink();
    if (!link?.enabled) return null;
    const message = buildServiceDocumentShareMessage(shareDocument, buildPublicServiceDocumentUrl(link.token));
    setShareMessage(message);
    return message;
  };

  const copyText = async (text: string, title: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title });
  };

  const revokeShareLink = async () => {
    if (!shareLink) return;
    const { error } = await serviceDb.rpc("revoke_service_document_share_link", { p_token: shareLink.token });
    if (error) {
      toast({ title: "No se pudo revocar", description: error.message, variant: "destructive" });
      return;
    }
    setShareLink({ ...shareLink, enabled: false });
    setShareMessage("");
    toast({ title: "Link revocado" });
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openAiAssistantForNewDocument} disabled={!canManageServiceDocuments}>
                <Bot className="mr-2 h-4 w-4" /> Crear con IA
              </Button>
              <Button onClick={openCreate} disabled={!canManageServiceDocuments}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto
              </Button>
            </div>
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
          <div className="w-full md:w-56">
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los clientes</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <section className="data-panel overflow-x-auto">
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
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={openAiAssistantForNewDocument} disabled={!canManageServiceDocuments}>
                    <Bot className="mr-2 h-4 w-4" /> Crear con IA
                  </Button>
                  <Button onClick={openCreate} disabled={!canManageServiceDocuments}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto
                  </Button>
                </div>
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
                  <TableHead className="w-[320px] min-w-[320px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDocuments.map((document) => (
                  <TableRow key={document.id} className="h-14">
                    <TableCell className="font-medium">{SERVICE_DOCUMENT_PREFIX}-{String(document.number).padStart(6, "0")}</TableCell>
                    <TableCell>{document.customers?.name ?? "Sin cliente"}</TableCell>
                    <TableCell>{formatIsoDate(document.issue_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={SERVICE_STATUS_BADGE_CLASS[document.status]}>{SERVICE_STATUS_LABEL[document.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(document.total ?? 0, document.currency)}</TableCell>
                    <TableCell className="w-[320px] min-w-[320px] whitespace-nowrap text-right">
                      <div className="flex flex-nowrap justify-end gap-1">
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
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-emerald-500 hover:text-emerald-400" title="Compartir" onClick={() => void openShare(document)}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                        {canPrintServiceDocuments ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-indigo-500 hover:text-indigo-400" title="Guardar PDF" onClick={() => void downloadServicePdf(document)} disabled={downloadingDocumentId === document.id}>
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canPrintServiceDocuments ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-400" title="Imprimir" onClick={() => void openServicePrint(document)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canEditServiceDocuments && document.status === "DRAFT" ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-400" title="Editar" onClick={() => openEdit(document)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {Array.from({ length: Math.max(0, pageSize - pagedDocuments.length) }, (_, index) => (
                  <TableRow key={`empty-${index}`} className="h-14" aria-hidden="true">
                    <TableCell colSpan={6} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        {documents.length > 0 ? (
          <DataTablePagination
            page={safePage}
            totalPages={totalPages}
            totalItems={documents.length}
            rangeStart={(safePage - 1) * pageSize + 1}
            rangeEnd={Math.min(safePage * pageSize, documents.length)}
            pageSize={pageSize}
            pageSizeOptions={SERVICE_PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(value) => setPageSize(value as (typeof SERVICE_PAGE_SIZE_OPTIONS)[number])}
            itemLabel="presupuestos"
          />
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
              <div>
                <DialogTitle>{editingDocumentId ? "Editar presupuesto de servicio" : "Nuevo presupuesto de servicio"}</DialogTitle>
                <DialogDescription>Formulario de presupuesto de servicio manual.</DialogDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAiAssistantOpen(true)} disabled={!canManageServiceDocuments}>
                <Bot className="mr-2 h-4 w-4" /> Asistente IA
              </Button>
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

            <section className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm lg:grid-cols-[1fr_1.2fr]">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Select value={form.currency} onValueChange={(value) => setForm((current) => ({ ...current, currency: value as "ARS" | "USD" }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modo de precio</Label>
                  <Select value={form.pricing_mode} onValueChange={(value) => setForm((current) => ({ ...current, pricing_mode: value as "DETAILED" | "GLOBAL_TOTAL", hide_line_prices: value === "GLOBAL_TOTAL" }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DETAILED">Detallado por linea</SelectItem>
                      <SelectItem value="GLOBAL_TOTAL">Precio final global</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.pricing_mode === "GLOBAL_TOTAL" ? (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Precio final del presupuesto</Label>
                    <Input className="h-9" type="number" min="0" step="0.01" value={form.global_total} onChange={(event) => setForm((current) => ({ ...current, global_total: event.target.value }))} />
                    <p className="text-xs text-muted-foreground">Usalo para detallar trabajos sin desglosar precios por item.</p>
                  </div>
                ) : null}
              </div>

              {form.currency === "USD" ? (
                <div className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Cotizacion USD</Label>
                    <Input className="h-9" type="number" min="0" step="0.01" value={form.exchange_rate} onChange={(event) => applyManualExchangeRate(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha cotizacion</Label>
                    <Input className="h-9" type="date" value={form.exchange_rate_date} onChange={(event) => setForm((current) => ({ ...current, exchange_rate_date: event.target.value, exchange_rate_source: "MANUAL" }))} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="h-9" onClick={() => void fetchExchangeRate()} disabled={exchangeRateLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" /> BNA
                    </Button>
                  </div>
                  <p className="md:col-span-3 text-xs text-muted-foreground">
                    La cotizacion queda guardada como snapshot. Si Banco Nacion falla, podes cargarla manualmente.
                  </p>
                </div>
              ) : null}
            </section>

            <section className="grid gap-2 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm">
              <Label className="text-xs">Texto introductorio</Label>
              <Textarea className="min-h-14 resize-none text-sm" rows={2} value={form.intro_text} onChange={(event) => setForm((current) => ({ ...current, intro_text: event.target.value }))} />
              <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                  <TableHeader><TableRow className="h-9"><TableHead>Descripción</TableHead><TableHead className="w-24">Cantidad</TableHead><TableHead className="w-24">Unidad</TableHead>{form.pricing_mode === "DETAILED" ? <TableHead className="w-32">Precio</TableHead> : null}{form.pricing_mode === "DETAILED" ? <TableHead className="w-32 text-right">Total</TableHead> : null}<TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>{lines.map((line, index) => (
                    <TableRow key={index} className="h-12">
                      <TableCell className="py-1.5"><Textarea className="min-h-12 resize-none text-sm" rows={2} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" type="number" min="0" step="0.001" value={line.quantity ?? ""} onChange={(event) => updateLine(index, { quantity: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" value={line.unit ?? ""} onChange={(event) => updateLine(index, { unit: event.target.value })} /></TableCell>
                      {form.pricing_mode === "DETAILED" ? <TableCell className="py-1.5"><Input className="h-9" type="number" min="0" step="0.01" value={line.unit_price ?? ""} onChange={(event) => updateLine(index, { unit_price: event.target.value ? Number(event.target.value) : null })} /></TableCell> : null}
                      {form.pricing_mode === "DETAILED" ? <TableCell className="py-1.5 text-right text-sm font-semibold">{formatMoney(calculateServiceLineTotal(line), form.currency)}</TableCell> : null}
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

            <section className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label className="text-xs">Imágenes / referencias</Label>
                  <p className="text-xs text-muted-foreground">JPG, PNG o WEBP hasta 10 MB. Solo las marcadas se muestran en impresión y link público.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="relative h-9 overflow-hidden">
                  <ImagePlus className="mr-2 h-4 w-4" /> Subir imágenes
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => { addAttachments(event.target.files); event.currentTarget.value = ""; }} />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {attachments.filter((attachment) => !attachment.remove).map((attachment) => (
                  <div key={attachment.id} className="rounded-lg border bg-background p-3">
                    {attachment.previewUrl ? <img src={attachment.previewUrl} alt={attachment.file_name} className="h-36 w-full rounded-md bg-muted object-contain" /> : null}
                    <div className="mt-3 grid gap-2">
                      <Input className="h-8" placeholder="Título opcional" value={attachment.title} onChange={(event) => updateAttachment(attachment.id, { title: event.target.value })} />
                      <Textarea className="min-h-12 resize-none text-sm" rows={2} placeholder="Descripción opcional" value={attachment.description} onChange={(event) => updateAttachment(attachment.id, { description: event.target.value })} />
                      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <input type="checkbox" checked={attachment.include_in_print} onChange={(event) => updateAttachment(attachment.id, { include_in_print: event.target.checked })} />
                        Mostrar en impresión
                      </label>
                      <div className="flex justify-between gap-2">
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveAttachment(attachment.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveAttachment(attachment.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeAttachment(attachment.id)}>Eliminar</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              <p className="text-xl font-extrabold tracking-tight">{formatMoney(total, form.currency)}</p>
              {form.currency === "USD" && Number(form.exchange_rate) > 0 ? (
                <p className="text-xs text-muted-foreground">Estimado {formatMoney(total * Number(form.exchange_rate), "ARS")}</p>
              ) : null}
            </div>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" className="px-6" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(shareDocument)} onOpenChange={(open) => { if (!open) { setShareDocument(null); setShareLink(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Compartir presupuesto</DialogTitle>
            <DialogDescription>Genera un link público seguro para WhatsApp o email. El cliente puede imprimir o guardar PDF desde el link.</DialogDescription>
          </DialogHeader>
          {shareDocument ? (
            <div className="grid gap-4">
              <section className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Estado del link</p>
                    <p className="text-sm text-muted-foreground">{shareLink?.enabled ? "Activo" : shareLink ? "Revocado" : "No generado"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void ensureShareLink()} disabled={shareLinkLoading}>
                      <Link2 className="mr-2 h-4 w-4" /> {shareLinkLoading ? "Generando..." : "Generar link"}
                    </Button>
                    <Button type="button" variant="outline" disabled={!shareLink?.enabled || shareLinkLoading} onClick={() => shareLink && void copyText(buildPublicServiceDocumentUrl(shareLink.token), "Link copiado")}>
                      Copiar link
                    </Button>
                    <Button type="button" variant="outline" disabled={!shareLink?.enabled || shareLinkLoading} onClick={() => void revokeShareLink()}>
                      Revocar link
                    </Button>
                  </div>
                </div>
                {shareLink?.enabled ? <Input className="mt-3" readOnly value={buildPublicServiceDocumentUrl(shareLink.token)} /> : null}
              </section>

              <section className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" /> WhatsApp</div>
                <Input placeholder="Número opcional" value={whatsAppPhone} onChange={(event) => setWhatsAppPhone(event.target.value)} />
                <Textarea rows={5} value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={shareLinkLoading} onClick={async () => { const message = await getShareMessageWithLink(); if (message) window.open(buildWhatsAppUrl({ phone: whatsAppPhone, message }), "_blank", "noopener,noreferrer"); }}>
                    Abrir WhatsApp
                  </Button>
                  <Button type="button" variant="outline" disabled={shareLinkLoading} onClick={async () => { const message = await getShareMessageWithLink(); if (message) void copyText(message, "Mensaje copiado"); }}>Copiar mensaje</Button>
                </div>
              </section>

              <section className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4" /> Email</div>
                <Input placeholder="Email opcional" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} />
                <Input placeholder="Asunto" value={shareSubject} onChange={(event) => setShareSubject(event.target.value)} />
                <Textarea rows={5} value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={shareLinkLoading} onClick={async () => { const message = await getShareMessageWithLink(); if (message) window.location.href = buildMailtoUrl({ email: shareEmail, subject: shareSubject, body: message }); }}>
                    Abrir cliente de correo
                  </Button>
                  <Button type="button" variant="outline" disabled={shareLinkLoading} onClick={async () => { const message = await getShareMessageWithLink(); if (message) void copyText(message, "Mensaje copiado"); }}>Copiar mensaje</Button>
                </div>
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ServiceDocumentPreviewDialog
        open={Boolean(previewDocumentId)}
        onClose={() => setPreviewDocumentId(null)}
        previewDocument={previewDocument}
        previewLines={previewLines}
        previewAttachments={selectedAttachments}
        selectedEvents={selectedEvents}
        eventUserNamesById={eventUserNamesById}
        settings={settings}
        onOpenPrint={(document) => void openServicePrint(document)}
      />
      <ServiceQuoteAiAssistantDialog
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        companyId={currentCompany?.id ?? null}
        customers={customers}
        currentLines={lines}
        currentNotes={[form.intro_text, form.closing_text].filter(Boolean).join("\n")}
        selectedCustomerId={form.customer_id}
        onApply={applyAiSuggestion}
      />
    </AppLayout>
  );
}
