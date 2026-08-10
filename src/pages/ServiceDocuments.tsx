import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Ban, Bot, Check, Copy, Download, Eye, ImagePlus, Link2, Mail, MessageCircle, MoreHorizontal, Pencil, Plus, Printer, RefreshCw, Send, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ClearableSearchInput } from "@/components/common/ClearableSearchInput";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { CountBadge, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { formatBusinessDate, formatMoney } from "@/lib/formatters";
import { openPrintWindow } from "@/lib/print";
import { choosePdfSaveTarget, savePrintHtmlAsPdf } from "@/lib/pdf-download";
import {
  acceptServiceDocumentAiSuggestion,
  createServiceDocumentShareLink,
  fetchActiveServiceDocumentShareLink,
  fetchServiceDocumentPrintResources,
  revokeServiceDocumentShareLink,
} from "@/features/services/api";
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
import type { ServiceDocument, ServiceDocumentAttachmentDraft, ServiceDocumentEvent, ServiceDocumentForm, ServiceDocumentLine, ServiceDocumentShareLink, ServiceDocumentStatus } from "@/features/services/types";

const STATUS_OPTIONS: Array<ServiceDocumentStatus | "ALL"> = ["ALL", "DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED"];
const ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SERVICE_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const SERVICE_STATUS_TONE: Record<ServiceDocumentStatus, "muted" | "info" | "success" | "danger" | "warning"> = {
  DRAFT: "muted",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "warning",
};

type AiSuggestionApplyParams = {
  suggestion: ServiceQuoteAiSuggestion;
  suggestionId: string | null;
  mode: ServiceQuoteAiApplyMode;
  customerId: string;
};

type PendingConfirmation =
  | { kind: "transition"; document: ServiceDocument; targetStatus: ServiceDocumentStatus }
  | { kind: "duplicate"; document: ServiceDocument }
  | { kind: "append-ai"; params: AiSuggestionApplyParams };

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
  const [actionDocument, setActionDocument] = useState<ServiceDocument | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
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
        await acceptServiceDocumentAiSuggestion({
          companyId: currentCompany?.id ?? null,
          suggestionId: pendingAiSuggestionId,
          documentId: savedDocument.id,
        });
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

  const openServicePrint = async (document: ServiceDocument) => {
    const win = openPrintWindow(`<!doctype html><html><head><title>Imprimiendo...</title><style>
      html,body{margin:0;padding:0;background:#fff}
      body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}
      </style></head><body>Preparando impresión...</body></html>`);
    if (!win) return;
    try {
      const resources = await fetchServiceDocumentPrintResources(currentCompany?.id ?? null, document.id);
      win.document.open();
      win.document.write(buildServiceDocumentPrintHtml({ document, ...resources, companySettings: settings }));
      win.document.close();
      win.focus();
    } catch (error) {
      win.close();
      toast({ title: "No se pudo preparar la impresión", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const downloadServicePdf = async (document: ServiceDocument) => {
    const fileName = `Presupuesto-Servicio-SERV-${String(document.number).padStart(6, "0")}.pdf`;
    let target;
    try {
      target = await choosePdfSaveTarget(fileName);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "No se pudo seleccionar el archivo", description: getErrorMessage(error), variant: "destructive" });
      return;
    }

    setDownloadingDocumentId(document.id);
    try {
      const resources = await fetchServiceDocumentPrintResources(currentCompany?.id ?? null, document.id);
      const html = buildServiceDocumentPrintHtml({
        document,
        ...resources,
        companySettings: settings,
      });
      await savePrintHtmlAsPdf({
        html,
        fileName,
        proof: { mode: "authenticated", kind: "service", documentId: document.id },
        target,
      });
      toast({ title: "PDF guardado" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "No se pudo descargar el PDF", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const triggerTransition = (document: ServiceDocument, targetStatus: ServiceDocumentStatus) => {
    setActionDocument(null);
    setPendingConfirmation({ kind: "transition", document, targetStatus });
  };

  const triggerDuplicate = (document: ServiceDocument) => {
    if (document.status === "CANCELLED") {
      toast({ title: "No se puede duplicar", description: "Los documentos anulados no se pueden duplicar.", variant: "destructive" });
      return;
    }
    setActionDocument(null);
    setPendingConfirmation({ kind: "duplicate", document });
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

  const applyConfirmedAiSuggestion = (params: AiSuggestionApplyParams, appendLines: boolean) => {
    const result = applyAiSuggestionToServiceDraft({
      form: { ...form, customer_id: params.customerId || form.customer_id },
      lines,
      suggestion: params.suggestion,
      mode: params.mode,
      appendLines,
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

  const applyAiSuggestion = (params: AiSuggestionApplyParams) => {
    const hasExistingLines = lines.some((line) => line.description.trim());
    if (editingDocumentId && hasExistingLines && params.mode !== "price") {
      setPendingConfirmation({ kind: "append-ai", params });
      return;
    }
    applyConfirmedAiSuggestion(params, true);
  };

  const confirmPendingAction = () => {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.kind === "transition") {
      transitionMutation.mutate({
        documentId: pendingConfirmation.document.id,
        targetStatus: pendingConfirmation.targetStatus,
      });
    } else if (pendingConfirmation.kind === "duplicate") {
      duplicateMutation.mutate(pendingConfirmation.document.id);
    } else {
      applyConfirmedAiSuggestion(pendingConfirmation.params, true);
    }
    setPendingConfirmation(null);
  };

  const confirmationContent = (() => {
    if (!pendingConfirmation) return null;
    if (pendingConfirmation.kind === "append-ai") {
      return {
        title: "Agregar propuesta al presupuesto",
        description: "El presupuesto ya tiene lineas. Las sugerencias de IA se agregaran sin reemplazar el trabajo cargado.",
        confirmLabel: "Agregar lineas",
      };
    }
    const documentNumber = `${SERVICE_DOCUMENT_PREFIX}-${String(pendingConfirmation.document.number).padStart(6, "0")}`;
    if (pendingConfirmation.kind === "duplicate") {
      return {
        title: "Duplicar presupuesto",
        description: `Se creara un nuevo borrador a partir de ${documentNumber}. El original no se modificara.`,
        confirmLabel: "Duplicar",
      };
    }
    return {
      title: `${SERVICE_STATUS_LABEL[pendingConfirmation.targetStatus]} presupuesto`,
      description: `El documento ${documentNumber} cambiara de estado a ${SERVICE_STATUS_LABEL[pendingConfirmation.targetStatus].toLowerCase()}.`,
      confirmLabel: SERVICE_STATUS_LABEL[pendingConfirmation.targetStatus],
    };
  })();

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
      const activeLink = await fetchActiveServiceDocumentShareLink(currentCompany?.id ?? null, document.id);
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
      const link = await createServiceDocumentShareLink(shareDocument.id);
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
    try {
      await revokeServiceDocumentShareLink(shareLink.token);
    } catch (error) {
      toast({ title: "No se pudo revocar", description: getErrorMessage(error), variant: "destructive" });
      return;
    }
    setShareLink({ ...shareLink, enabled: false });
    setShareMessage("");
    toast({ title: "Link revocado" });
  };

  const previewDocument = selectedDocument ?? null;
  const previewLines = selectedLines;
  const documentColumns: ColumnDef<ServiceDocument, unknown>[] = [
    {
      id: "document",
      header: "Documento",
      cell: ({ row }) => (
        <PrimaryCell
          title={`${SERVICE_DOCUMENT_PREFIX}-${String(row.original.number).padStart(6, "0")}`}
          metadata={row.original.reference || "Sin referencia"}
        />
      ),
    },
    {
      id: "customer",
      header: "Cliente",
      cell: ({ row }) => <PrimaryCell title={row.original.customers?.name ?? "Sin cliente"} />,
    },
    {
      accessorKey: "issue_date",
      header: "Fecha",
      cell: ({ row }) => formatBusinessDate(row.original.issue_date),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <StatusBadge tone={SERVICE_STATUS_TONE[row.original.status]}>
          {SERVICE_STATUS_LABEL[row.original.status]}
        </StatusBadge>
      ),
    },
    {
      id: "total",
      header: "Total",
      meta: { className: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <MoneyCell value={formatMoney(row.original.total ?? 0, row.original.currency)} format="plain" />,
    },
    {
      id: "actions",
      header: "Acciones",
      meta: { className: "w-44 min-w-44 text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <RowActions>
          <RowActionButton label="Vista previa" tone="view" onClick={() => openPreview(row.original)}>
            <Eye className="h-4 w-4" />
          </RowActionButton>
          {canPrintServiceDocuments ? (
            <RowActionButton
              label="Guardar PDF"
              onClick={() => void downloadServicePdf(row.original)}
              disabled={downloadingDocumentId === row.original.id}
            >
              <Download className="h-4 w-4" />
            </RowActionButton>
          ) : null}
          <RowActionButton label="Compartir" onClick={() => void openShare(row.original)}>
            <Link2 className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton label="Mas acciones" onClick={() => setActionDocument(row.original)}>
            <MoreHorizontal className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
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

        <FilterToolbar>
          <div className="w-full md:max-w-sm"><ClearableSearchInput placeholder="Buscar cliente, numero o referencia..." value={search} onValueChange={setSearch} /></div>
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
        </FilterToolbar>

        <Card className="min-w-0 border-border/70 shadow-none">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle>Presupuestos de servicio</CardTitle><CardDescription>Seguimiento comercial, vista previa y acciones sobre cada presupuesto.</CardDescription></div>
            <CountBadge>{documents.length} {documents.length === 1 ? "registro" : "registros"}</CountBadge>
          </CardHeader>
          <CardContent className="p-0">
          {!isLoading && documents.length === 0 ? (
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
            <div className="overflow-x-auto">
              <DataTable
                columns={documentColumns}
                data={pagedDocuments}
                emptyMessage="No hay presupuestos para los filtros seleccionados."
                isLoading={isLoading}
                loadingMessage="Cargando presupuestos..."
                getRowId={(document) => document.id}
                reserveEmptyRows={pageSize}
                className="min-w-[820px]"
              />
            </div>
          )}
          </CardContent>
        </Card>
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
      </PageContainer>

      <Dialog open={Boolean(actionDocument)} onOpenChange={(open) => { if (!open) setActionDocument(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Acciones del presupuesto</DialogTitle>
            <DialogDescription>
              {actionDocument
                ? `${SERVICE_DOCUMENT_PREFIX}-${String(actionDocument.number).padStart(6, "0")} · ${actionDocument.customers?.name ?? "Sin cliente"}`
                : "Selecciona una accion."}
            </DialogDescription>
          </DialogHeader>
          {actionDocument ? (
            <div className="grid gap-1">
              {canManageServiceDocuments && canTransitionServiceDocument(actionDocument, "SENT") ? (
                <Button variant="ghost" className="justify-start" onClick={() => triggerTransition(actionDocument, "SENT")} disabled={transitionMutation.isPending}>
                  <Send className="mr-2 h-4 w-4 text-info" /> Enviar al cliente
                </Button>
              ) : null}
              {canApproveServiceDocuments && canTransitionServiceDocument(actionDocument, "APPROVED") ? (
                <Button variant="ghost" className="justify-start" onClick={() => triggerTransition(actionDocument, "APPROVED")} disabled={transitionMutation.isPending}>
                  <Check className="mr-2 h-4 w-4 text-success" /> Aprobar
                </Button>
              ) : null}
              {canApproveServiceDocuments && canTransitionServiceDocument(actionDocument, "REJECTED") ? (
                <Button variant="ghost" className="justify-start" onClick={() => triggerTransition(actionDocument, "REJECTED")} disabled={transitionMutation.isPending}>
                  <X className="mr-2 h-4 w-4 text-destructive" /> Rechazar
                </Button>
              ) : null}
              {canCancelServiceDocuments && canTransitionServiceDocument(actionDocument, "CANCELLED") ? (
                <Button variant="ghost" className="justify-start" onClick={() => triggerTransition(actionDocument, "CANCELLED")} disabled={transitionMutation.isPending}>
                  <Ban className="mr-2 h-4 w-4 text-warning" /> Anular
                </Button>
              ) : null}
              {canEditServiceDocuments && actionDocument.status === "DRAFT" ? (
                <Button variant="ghost" className="justify-start" onClick={() => { openEdit(actionDocument); setActionDocument(null); }}>
                  <Pencil className="mr-2 h-4 w-4 text-warning" /> Editar
                </Button>
              ) : null}
              {canManageServiceDocuments && actionDocument.status !== "CANCELLED" ? (
                <Button variant="ghost" className="justify-start" onClick={() => triggerDuplicate(actionDocument)} disabled={duplicateMutation.isPending}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicar
                </Button>
              ) : null}
              {canPrintServiceDocuments ? (
                <Button title="Imprimir" variant="ghost" className="justify-start" onClick={() => { void openServicePrint(actionDocument); setActionDocument(null); }}>
                  <Printer className="mr-2 h-4 w-4 text-warning" /> Imprimir
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingConfirmation)} onOpenChange={(open) => { if (!open) setPendingConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationContent?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationContent?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingAction}
              disabled={transitionMutation.isPending || duplicateMutation.isPending}
            >
              {confirmationContent?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <div className="grid gap-3 md:hidden">
                {lines.map((line, index) => (
                  <div key={index} className="rounded-lg border bg-background p-3 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trabajo {index + 1}</p>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Eliminar trabajo ${index + 1}`} onClick={() => removeLine(index)} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid gap-3">
                      <div className="space-y-1"><Label className="text-xs">Tipo de contenido</Label><Select value={line.line_type ?? "ITEM"} onValueChange={(value) => updateLine(index, { line_type: value as ServiceDocumentLine["line_type"] })}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ITEM">Trabajo / ítem</SelectItem><SelectItem value="TITLE">Título de sección</SelectItem><SelectItem value="SUBTITLE">Subtítulo</SelectItem></SelectContent></Select></div>
                      <div className="space-y-1"><Label className="text-xs">Descripción</Label><Textarea className="min-h-20 resize-y text-sm" rows={3} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></div>
                      {(line.line_type ?? "ITEM") === "ITEM" ? <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Cantidad</Label><Input className="h-10" inputMode="decimal" type="number" min="0" step="0.001" value={line.quantity ?? ""} onChange={(event) => updateLine(index, { quantity: event.target.value ? Number(event.target.value) : null })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Unidad</Label><Input className="h-10" value={line.unit ?? ""} onChange={(event) => updateLine(index, { unit: event.target.value })} /></div>
                      </div> : null}
                      {form.pricing_mode === "DETAILED" && (line.line_type ?? "ITEM") === "ITEM" ? (
                        <div className="grid grid-cols-2 items-end gap-3">
                          <div className="space-y-1"><Label className="text-xs">Precio unitario</Label><Input className="h-10" inputMode="decimal" type="number" min="0" step="0.01" value={line.unit_price ?? ""} onChange={(event) => updateLine(index, { unit_price: event.target.value ? Number(event.target.value) : null })} /></div>
                          <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p><p className="font-semibold">{formatMoney(calculateServiceLineTotal(line), form.currency)}</p></div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-lg border bg-background md:block">
                <Table>
                  <TableHeader><TableRow className="h-9"><TableHead>Descripción</TableHead><TableHead className="w-24">Cantidad</TableHead><TableHead className="w-24">Unidad</TableHead>{form.pricing_mode === "DETAILED" ? <TableHead className="w-32">Precio</TableHead> : null}{form.pricing_mode === "DETAILED" ? <TableHead className="w-32 text-right">Total</TableHead> : null}<TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>{lines.map((line, index) => (
                    <TableRow key={index} className="h-12">
                      <TableCell className="space-y-1 py-1.5"><Select value={line.line_type ?? "ITEM"} onValueChange={(value) => updateLine(index, { line_type: value as ServiceDocumentLine["line_type"] })}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ITEM">Trabajo / ítem</SelectItem><SelectItem value="TITLE">Título</SelectItem><SelectItem value="SUBTITLE">Subtítulo</SelectItem></SelectContent></Select><Textarea className="min-h-12 resize-none text-sm" rows={2} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" type="number" min="0" step="0.001" value={line.quantity ?? ""} onChange={(event) => updateLine(index, { quantity: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="py-1.5"><Input className="h-9" value={line.unit ?? ""} onChange={(event) => updateLine(index, { unit: event.target.value })} /></TableCell>
                      {form.pricing_mode === "DETAILED" ? <TableCell className="py-1.5"><Input className="h-9" type="number" min="0" step="0.01" value={line.unit_price ?? ""} onChange={(event) => updateLine(index, { unit_price: event.target.value ? Number(event.target.value) : null })} /></TableCell> : null}
                      {form.pricing_mode === "DETAILED" ? <TableCell className="py-1.5 text-right text-sm font-semibold">{formatMoney(calculateServiceLineTotal(line), form.currency)}</TableCell> : null}
                      <TableCell className="py-1.5"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLine(index)} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setLines((current) => [...current, { ...EMPTY_SERVICE_LINE, sort_order: current.length + 1 }])}><Plus className="mr-2 h-4 w-4" /> Agregar trabajo</Button><Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setLines((current) => [...current, { ...EMPTY_SERVICE_LINE, line_type: "TITLE", quantity: null, unit: null, unit_price: null, sort_order: current.length + 1 }])}>Agregar título</Button><Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setLines((current) => [...current, { ...EMPTY_SERVICE_LINE, line_type: "SUBTITLE", quantity: null, unit: null, unit_price: null, sort_order: current.length + 1 }])}>Agregar subtítulo</Button></div>
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
