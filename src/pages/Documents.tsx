import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "@/hooks/useSearch";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { getErrorMessage } from "@/lib/errors";
import {
  canCloneBudgetToRemito,
  canCreateCashSale,
  canCreateDocumentDraft,
  canEditDocumentDraft,
  canIssueRemito,
  canPrintDocument,
  canTransitionDocumentTo,
} from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { openPrintWindow } from "@/lib/print";
import { Copy, Link2, MessageCircle, Plus, Search, Unlink } from "lucide-react";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { EMPTY_LINE } from "@/features/documents/constants";
import { DocumentsDataTable } from "@/features/documents/components/DocumentsDataTable";
import {
  DocumentConfirmationDialog,
  type DocumentConfirmationTone,
} from "@/features/documents/components/DocumentConfirmationDialog";
import { RegisterDocumentInCashDialog } from "@/features/documents/components/RegisterDocumentInCashDialog";
import { registerCashSaleFromRemito } from "@/features/cash/api/registerCashSaleFromRemito";
import type { PaymentMethod } from "@/features/cash/types";
import { useDocumentsData } from "@/features/documents/hooks/useDocumentsData";
import { useDocumentDraftLoader } from "@/features/documents/hooks/useDocumentDraftLoader";
import { useDocumentsMutations } from "@/features/documents/hooks/useDocumentsMutations";
import { buildDocumentLineFromItem } from "@/features/documents/lib/buildDocumentLineFromItem";
import { mergeComboDocumentLines } from "@/features/documents/lib/mergeComboDocumentLines";
import { DUPLICATE_DOCUMENT_CONFIRMATION } from "@/features/documents/lib/duplicate";
import { buildDocumentPrintHtml } from "@/features/documents/print";
import { buildDocumentShareMessage, buildPublicDocumentUrl } from "@/features/documents/share";
import type {
  CustomerKind,
  DocLineRow,
  DocRow,
  DocStatus,
  DocType,
  DocumentFormState,
  DocumentShareLink,
  InternalRemitoType,
  LineDraft,
  PriceListItemRow,
} from "@/features/documents/types";
import { formatNumber } from "@/features/documents/utils";
import { buildComboLines } from "@/features/combos/lib/buildComboLines";
import { roundPrice } from "@/features/pricing/rounding";
import { buildWhatsAppUrl } from "@/features/services/share";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

type PendingDocumentAction =
  | { kind: "change-price-list"; priceListId: string }
  | { kind: "annul"; documentId: string }
  | { kind: "issue"; documentId: string; isReturn: boolean }
  | { kind: "duplicate"; documentId: string; closePreview: boolean }
  | { kind: "generate-return"; documentId: string };

interface DocumentConfirmationCopy {
  title: string;
  description: string;
  confirmLabel: string;
  tone: DocumentConfirmationTone;
}

const DocumentsEditorDialog = lazy(async () => {
  const module = await import("@/features/documents/components/DocumentsEditorDialog");
  return { default: module.DocumentsEditorDialog };
});

const DocumentsPreviewDialog = lazy(async () => {
  const module = await import("@/features/documents/components/DocumentsPreviewDialog");
  return { default: module.DocumentsPreviewDialog };
});

function DocumentsDialogLoader() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      Cargando documento...
    </div>
  );
}

function buildEmptyDocumentForm(defaultPointOfSale: number, defaultCustomerId = ""): DocumentFormState {
  return {
    recipient_type: defaultCustomerId ? "REGISTERED" : "OCCASIONAL",
    doc_type: "PRESUPUESTO",
    point_of_sale: defaultPointOfSale,
    customer_id: defaultCustomerId,
    technician_id: "",
    service_id: "",
    customer_name: defaultCustomerId ? "" : "Cliente ocasional",
    customer_tax_condition: "",
    customer_tax_id: "",
    customer_kind: "GENERAL" as CustomerKind,
    internal_remito_type: "" as InternalRemitoType | "",
    payment_terms: "",
    delivery_address: "",
    salesperson: "",
    valid_until: "",
    price_list_id: "",
    notes: "",
  };
}

export default function DocumentsPage() {
  const { user, roles, currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings: companySettings } = useCompanyBrand();
  const defaultPointOfSale = companySettings.default_point_of_sale ?? 1;
  const priceRoundingConfig = useMemo(
    () => ({
      enabled: companySettings.price_rounding_enabled,
      increment: companySettings.price_rounding_increment,
    }),
    [companySettings.price_rounding_enabled, companySettings.price_rounding_increment],
  );

  const { search, deferredSearch, setSearch, trimmedSearch } = useSearch();
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [cashDocument, setCashDocument] = useState<DocRow | null>(null);
  const [registerCashOpen, setRegisterCashOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingDocumentAction | null>(null);
  const [shareDocument, setShareDocument] = useState<DocRow | null>(null);
  const [shareCustomerId, setShareCustomerId] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const [shareLink, setShareLink] = useState<DocumentShareLink | null>(null);
  const [shareMessageText, setShareMessageText] = useState("");
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [documentsPageSize, setDocumentsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [draftForm, setDraftForm] = useState<DocumentFormState>(() =>
    buildEmptyDocumentForm(defaultPointOfSale),
  );
  const [lines, setLines] = useState<LineDraft[]>([]);

  const {
    customers,
    technicians,
    allTechnicians,
    serviceOptions,
    items,
    priceLists,
    availableItems,
    priceByItem,
    priceListItemByItemId,
    documents,
    isLoading,
    selectedLines,
    selectedEvents,
    eventUserNamesById,
    selectedDocumentCashUsage,
    cashRegisteredDocumentIds,
    selectedDocumentClosureClosed,
    selectedDocument,
    sourceDocumentLabel,
    combos,
    comboLinesByComboId,
  } = useDocumentsData({
    search: trimmedSearch,
    typeFilter,
    statusFilter,
    customerFilter,
    technicianFilter,
    selectedDocId,
    selectedPriceListId: draftForm.price_list_id,
    currentCompanyId: currentCompany?.id ?? null,
  });

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );
  const editingSourceDocumentLabel = useMemo(() => {
    if (!editingDocId) return null;
    const document = documentsById.get(editingDocId);
    if (!document?.source_document_id) return null;
    if (document.source_document_number_snapshot && document.source_document_type) {
      return `${document.source_document_type} ${document.source_document_number_snapshot}`;
    }
    const source = documentsById.get(document.source_document_id);
    return source ? `${source.doc_type} ${formatNumber(source.document_number, source.point_of_sale)}` : null;
  }, [documentsById, editingDocId]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const combosById = useMemo(() => new Map(combos.map((combo) => [combo.id, combo])), [combos]);
  const totalDraft = useMemo(
    () => lines.reduce((accumulator, line) => accumulator + line.quantity * line.unit_price, 0),
    [lines],
  );
  const applyRounding = useCallback(
    (price: number) => {
      const selectedPriceList = priceLists.find((priceList) => priceList.id === draftForm.price_list_id) ?? null;
      let nextPrice = price;
      if (selectedPriceList && selectedPriceList.round_mode !== "none") {
        if (selectedPriceList.round_mode === "integer") nextPrice = Math.round(price);
        if (selectedPriceList.round_mode === "tens") nextPrice = Math.round(price / 10) * 10;
        if (selectedPriceList.round_mode === "hundreds") nextPrice = Math.round(price / 100) * 100;
        if (selectedPriceList.round_mode === "x99") nextPrice = Math.floor(price / 100) * 100 + 99;
      }
      return roundPrice(nextPrice, priceRoundingConfig);
    },
    [draftForm.price_list_id, priceLists, priceRoundingConfig],
  );
  const documentsPagination = usePaginationSlice({
    items: documents,
    page: documentsPage,
    pageSize: documentsPageSize,
  });
  const linkedDocumentId = searchParams.get("document_id");
  const serviceOptionsById = useMemo(
    () => new Map(serviceOptions.map((service) => [service.id, service])),
    [serviceOptions],
  );
  const selectedServiceOption = selectedDocument?.service_id
    ? serviceOptionsById.get(selectedDocument.service_id) ?? null
    : null;
  useEffect(() => {
    if (!linkedDocumentId) return;
    setSelectedDocId(linkedDocumentId);
    setDetailOpen(true);
  }, [linkedDocumentId]);

  useEffect(() => {
    setDocumentsPage(1);
  }, [trimmedSearch, typeFilter, statusFilter, customerFilter, technicianFilter, documentsPageSize]);

  useEffect(() => {
    if (draftForm.price_list_id || priceLists.length === 0) return;
    setDraftForm((previousForm) => ({ ...previousForm, price_list_id: priceLists[0].id }));
  }, [draftForm.price_list_id, priceLists]);


  const syncLineWithPriceList = useCallback(
    (
      line: LineDraft,
      priceListRow: PriceListItemRow | undefined,
      forceListPrice = false,
    ): LineDraft => {
      if (!priceListRow) return line;
      const item = itemsById.get(priceListRow.item_id);
      if (!item) return line;

      return buildDocumentLineFromItem({
        item,
        quantity: line.quantity,
        currentLine: line,
        priceListRow,
        priceByItem,
        applyRounding: (price) => roundPrice(price, priceRoundingConfig),
        forceListPrice,
      });
    },
    [itemsById, priceByItem, priceRoundingConfig],
  );

  useEffect(() => {
    if (!draftForm.price_list_id) return;

    setLines((previousLines) =>
      previousLines.map((line) => {
        if (!line.item_id) return line;
        return syncLineWithPriceList(line, priceListItemByItemId.get(line.item_id));
      }),
    );
  }, [draftForm.price_list_id, priceListItemByItemId, syncLineWithPriceList]);

  const resetDraftForm = () => {
    setEditingDocId(null);
    setDraftForm(buildEmptyDocumentForm(defaultPointOfSale));
    setLines([]);
  };

  const loadDraftForEditing = useDocumentDraftLoader({ documentsById });

  const openCreateDialog = () => {
    if (!canCreateDocumentDraft(roles)) return;
    resetDraftForm();
    setDialogOpen(true);
  };

  const openEditDialog = async (documentId: string) => {
    if (!canEditDocumentDraft(roles)) return;

    try {
      const draft = await loadDraftForEditing(documentId);
      setEditingDocId(draft.editingDocId);
      setDraftForm(draft.form);
      setLines(draft.lines);
      setDialogOpen(true);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const {
    upsertDraftMutation,
    issueMutation,
    transitionMutation,
    cloneAsRemitoMutation,
    cloneAsReturnMutation,
    duplicateDocumentMutation,
    setExternalInvoiceMutation,
    clearExternalInvoiceMutation,
  } = useDocumentsMutations({
    currentCompanyId: currentCompany?.id ?? null,
    userId: user?.id,
    documents,
    customers,
    technicians,
    serviceOptions,
    lines,
    draftForm,
    totalDraft,
    editingDocId,
    priceByItem,
    priceListItemByItemId,
    priceRoundingConfig,
    resetDraftForm,
    setDialogOpen,
    toast,
  });

  const canRegisterInCash = canCreateCashSale(roles, {
    companyRoleCodes,
    companyPermissionCodes,
  });

  const registerCashMutation = useMutation({
    mutationFn: ({ document, paymentMethod }: { document: DocRow; paymentMethod: PaymentMethod }) => {
      if (!currentCompany?.id) throw new Error("Selecciona una empresa activa antes de registrar en Caja.");
      return registerCashSaleFromRemito({
        companyId: currentCompany.id,
        documentId: document.id,
        paymentMethod,
      });
    },
    onSuccess: async (_sale, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.cashUsage(currentCompany?.id ?? null) }),
        queryClient.invalidateQueries({ queryKey: ["cash-sales", currentCompany?.id ?? "no-company"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.accountSummary(currentCompany?.id ?? null, variables.document.customer_id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.accountEntries(currentCompany?.id ?? null, variables.document.customer_id) }),
      ]);
      setRegisterCashOpen(false);
      setCashDocument(null);
      toast({
        title: "Registrado en Caja",
        description: selectedDocumentClosureClosed
          ? "El movimiento quedó posterior al cierre existente, sin reabrirlo."
          : "El movimiento quedó asociado al remito.",
      });
    },
    onError: (error) => {
      toast({ title: "No se pudo registrar en Caja", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const openRegisterInCash = (document: DocRow) => {
    if (!canRegisterInCash) return;
    setSelectedDocId(document.id);
    setCashDocument(document);
    setRegisterCashOpen(true);
  };

  const isBlankLine = (line: LineDraft) =>
    line.item_id === null
    && line.description.trim() === ""
    && line.quantity === EMPTY_LINE.quantity
    && line.unit_price === EMPTY_LINE.unit_price;

  const applyPickItemToLines = (draftLines: LineDraft[], index: number, itemId: string) => {
    if (!draftLines[index]) return;

    if (!itemId) {
      const current = draftLines[index];
      draftLines[index] = {
        ...current,
        item_id: null,
        sku_snapshot: "",
        unit: current.unit || "un",
        pricing_mode: "MANUAL_PRICE",
        suggested_unit_price: current.unit_price,
        base_cost_snapshot: null,
        list_flete_pct_snapshot: null,
        list_utilidad_pct_snapshot: null,
        list_impuesto_pct_snapshot: null,
        manual_margin_pct: null,
        price_overridden_by: null,
        price_overridden_at: null,
      };
      return;
    }

    const item = itemsById.get(itemId);
    if (!item) return;

    draftLines[index] = draftForm.price_list_id
      ? buildDocumentLineFromItem({
          item,
          quantity: draftLines[index].quantity,
          currentLine: draftLines[index],
          priceListRow: priceListItemByItemId.get(itemId),
          priceByItem,
          applyRounding: (price) => roundPrice(price, priceRoundingConfig),
          forceListPrice: true,
        })
      : buildDocumentLineFromItem({
          item,
          quantity: draftLines[index].quantity,
          currentLine: draftLines[index],
          applyRounding: (price) => roundPrice(price, priceRoundingConfig),
        });
  };

  const onPickItem = (index: number, itemId: string) => {
    setLines((previous) => {
      const next = [...previous];
      applyPickItemToLines(next, index, itemId);
      return next;
    });
  };

  const onAddItem = (itemId: string) => {
    setLines((previous) => {
      const existingIndex = previous.findIndex((l) => l.item_id === itemId);
      if (existingIndex >= 0) {
        const next = [...previous];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: (next[existingIndex].quantity || 0) + 1,
        };
        return next;
      }

      const next = [...previous];
      const blankIndex = next.findIndex(isBlankLine);
      const index = blankIndex >= 0 ? blankIndex : next.length;
      if (index === next.length) next.push(EMPTY_LINE);
      applyPickItemToLines(next, index, itemId);
      return next;
    });
  };

  const onAddCombo = (comboId: string, quantity: number) => {
    const combo = combosById.get(comboId);
    if (!combo || !combo.is_active || !Number.isFinite(quantity) || quantity <= 0) return;
    const comboLines = comboLinesByComboId.get(comboId) ?? [];
    if (comboLines.length === 0) return;
    const builtLines = buildComboLines({
      comboName: combo.name,
      lines: comboLines,
      multiplier: quantity,
      availableItems: items,
      priceByItem,
      priceListItemByItemId,
      applyRounding,
      nowIso: new Date().toISOString(),
      userId: user?.id,
    });
    setLines((previous) => mergeComboDocumentLines(previous, builtLines));
  };

  const onPriceListChange = (priceListId: string) => {
    if (priceListId === draftForm.price_list_id) return;

    const hasLoadedLines = lines.some(
      (line) =>
        line.item_id !== null ||
        line.description.trim() !== "" ||
        line.quantity !== EMPTY_LINE.quantity ||
        line.unit_price !== EMPTY_LINE.unit_price,
    );

    if (hasLoadedLines) {
      setPendingAction({ kind: "change-price-list", priceListId });
      return;
    }

    setDraftForm((previousForm) => ({ ...previousForm, price_list_id: priceListId }));
    setLines([]);
  };

  const confirmationCopy: DocumentConfirmationCopy | null = pendingAction
    ? (() => {
        switch (pendingAction.kind) {
          case "change-price-list":
            return {
              title: "Cambiar lista de precios",
              description:
                "Se eliminaran todas las lineas cargadas para evitar mezclar productos y precios de listas diferentes.",
              confirmLabel: "Cambiar lista",
              tone: "warning",
            };
          case "annul":
            return {
              title: "Anular documento",
              description: "El documento quedara anulado y esta accion no se puede deshacer.",
              confirmLabel: "Anular documento",
              tone: "danger",
            };
          case "issue":
            return pendingAction.isReturn
              ? {
                  title: "Emitir devolucion",
                  description: "Se registrara el ingreso de stock por las cantidades cargadas.",
                  confirmLabel: "Emitir devolucion",
                  tone: "warning",
                }
              : {
                  title: "Emitir remito",
                  description:
                    "Se registrara la salida de stock. Verifica cliente, productos y cantidades antes de continuar.",
                  confirmLabel: "Emitir remito",
                  tone: "warning",
                };
          case "duplicate":
            return {
              title: "Duplicar documento",
              description: DUPLICATE_DOCUMENT_CONFIRMATION,
              confirmLabel: "Crear borrador",
              tone: "info",
            };
          case "generate-return":
            return {
              title: "Generar devolucion",
              description:
                "Se creara un borrador de devolucion vinculado a este remito. Podras revisarlo antes de emitirlo.",
              confirmLabel: "Generar devolucion",
              tone: "warning",
            };
        }
      })()
    : null;

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    switch (action.kind) {
      case "change-price-list":
        setDraftForm((previousForm) => ({ ...previousForm, price_list_id: action.priceListId }));
        setLines([]);
        break;
      case "annul":
        transitionMutation.mutate({ documentId: action.documentId, targetStatus: "ANULADO" });
        break;
      case "issue":
        issueMutation.mutate(action.documentId);
        break;
      case "duplicate":
        duplicateDocumentMutation.mutate(action.documentId, {
          onSuccess: (newDocumentId) => {
            if (action.closePreview) setDetailOpen(false);
            void openEditDialog(newDocumentId);
          },
        });
        break;
      case "generate-return":
        cloneAsReturnMutation.mutate(action.documentId);
        break;
    }
  };

  const removeLine = (index: number) => {
    setLines((previousLines) => previousLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const printDocument = async (document: DocRow) => {
    const { data: lineRows, error: linesError } = await supabase
      .from("document_lines")
      .select("line_order, sku_snapshot, description, unit, quantity, unit_price, line_total")
      .eq("document_id", document.id)
      .order("line_order");

    if (linesError) {
      toast({
        title: "No se pudo preparar la impresion",
        description: getErrorMessage(linesError),
        variant: "destructive",
      });
      return;
    }

    let technicianName: string | null = null;
    if (document.technician_id) {
      const { data: technicianData } = await supabase
        .from("technicians")
        .select("name")
        .eq("id", document.technician_id)
        .maybeSingle();

      technicianName = technicianData?.name ?? null;
    }

    const win = openPrintWindow(
      buildDocumentPrintHtml({
        document,
        lines: (lineRows ?? []) as Array<
          Pick<
            DocLineRow,
            | "line_order"
            | "sku_snapshot"
            | "description"
            | "quantity"
            | "unit"
            | "unit_price"
            | "line_total"
          >
        >,
        companySettings,
        technicianName,
      }),
    );

    if (!win) {
      toast({
        title: "No se pudo abrir la impresion",
        description: "El navegador bloqueo la ventana emergente. Habilitala para Stock Sur y reintenta.",
        variant: "destructive",
      });
    }
  };

  const openDocumentShare = async (document: DocRow) => {
    if (document.doc_type === "REMITO_DEVOLUCION") {
      toast({ title: "Documento no compartible", description: "Los links públicos están disponibles para presupuestos y remitos." });
      return;
    }
    setShareDocument(document);
    setShareCustomerId(document.customer_id ?? "");
    setSharePhone(customers.find((customer) => customer.id === document.customer_id)?.phone ?? "");
    setShareLink(null);
    setShareMessageText("");
    setShareLinkLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_share_links")
        .select("*")
        .eq("document_id", document.id)
        .eq("enabled", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const activeLink = ((data ?? []) as unknown as DocumentShareLink[])[0] ?? null;
      setShareLink(activeLink);
      if (activeLink) setShareMessageText(buildDocumentShareMessage(document, buildPublicDocumentUrl(activeLink.token)));
    } catch (error) {
      toast({ title: "No se pudo consultar el link", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setShareLinkLoading(false);
    }
  };

  const ensureDocumentShareLink = async () => {
    if (!shareDocument) return null;
    if (shareLink?.enabled) return shareLink;
    setShareLinkLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_document_share_link", {
        p_document_id: shareDocument.id,
        p_expires_at: null,
      });
      if (error) throw error;
      const link = data as unknown as DocumentShareLink;
      setShareLink(link);
      setShareMessageText(buildDocumentShareMessage(shareDocument, buildPublicDocumentUrl(link.token)));
      return link;
    } catch (error) {
      toast({ title: "No se pudo generar el link", description: getErrorMessage(error), variant: "destructive" });
      return null;
    } finally {
      setShareLinkLoading(false);
    }
  };

  const revokeDocumentShareLink = async () => {
    if (!shareLink) return;
    const { error } = await supabase.rpc("revoke_document_share_link", { p_token: shareLink.token });
    if (error) {
      toast({ title: "No se pudo revocar", description: getErrorMessage(error), variant: "destructive" });
      return;
    }
    setShareLink({ ...shareLink, enabled: false });
    setShareMessageText("");
    toast({ title: "Link revocado" });
  };

  const getDocumentShareMessage = async () => {
    if (!shareDocument) return null;
    const link = await ensureDocumentShareLink();
    if (!link?.enabled) return null;
    const message = buildDocumentShareMessage(shareDocument, buildPublicDocumentUrl(link.token));
    setShareMessageText(message);
    return message;
  };

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para crear documentos, emitir remitos y revisar su historial." />
        ) : null}

        <PageHeader
          eyebrow="Presupuestos y remitos"
          title="Documentos"
          subtitle="Presupuestos y remitos con mejor jerarquia visual, manteniendo la misma logica de estados, impresion y transiciones."
          actions={(
            <Button onClick={openCreateDialog} disabled={!canCreateDocumentDraft(roles)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo documento
            </Button>
          )}
        />

        <FilterBar>
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, CUIT, número o factura externa..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="w-full md:w-52">
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as DocType | "ALL")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="PRESUPUESTO">Presupuestos</SelectItem>
                <SelectItem value="REMITO">Remitos</SelectItem>
                <SelectItem value="REMITO_DEVOLUCION">Devoluciones</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-52">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as DocStatus | "ALL")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="ENVIADO">Enviado</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                <SelectItem value="EMITIDO">Emitido</SelectItem>
                <SelectItem value="ANULADO">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-56">
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
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

          <div className="w-full md:w-56">
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tecnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tecnicos</SelectItem>
                {technicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {technician.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <DocumentsDataTable
          documents={documentsPagination.pagedItems}
          isLoading={isLoading}
          pageSize={documentsPageSize}
          technicianNamesById={new Map(allTechnicians.map((technician) => [technician.id, technician.name]))}
          onOpenDetail={(documentId) => {
            setSelectedDocId(documentId);
            setDetailOpen(true);
          }}
          onPrint={(document) => {
            if (!canPrintDocument(roles)) return;
            void printDocument(document);
          }}
          onShare={(document) => void openDocumentShare(document)}
          onEditDraft={openEditDialog}
          onTransition={(documentId, targetStatus) => {
            const status = targetStatus as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO";
            if (!canTransitionDocumentTo(roles, status)) return;
            if (status === "ANULADO") {
              setPendingAction({ kind: "annul", documentId });
              return;
            }
            transitionMutation.mutate({ documentId, targetStatus: status });
          }}
          onIssueRemito={(documentId) => {
            if (!canIssueRemito(roles)) return;
            const document = documentsById.get(documentId);
            setPendingAction({
              kind: "issue",
              documentId,
              isReturn: document?.doc_type === "REMITO_DEVOLUCION",
            });
          }}
          onCloneAsRemito={(documentId) => {
            if (!canCloneBudgetToRemito(roles)) return;
            cloneAsRemitoMutation.mutate(documentId);
          }}
          onDuplicateDocument={(documentId) => {
            if (!canCreateDocumentDraft(roles)) return;
            setPendingAction({ kind: "duplicate", documentId, closePreview: false });
          }}
          onGenerateReturn={(documentId) => {
            setPendingAction({ kind: "generate-return", documentId });
          }}
          onRegisterInCash={openRegisterInCash}
          cashRegisteredDocumentIds={cashRegisteredDocumentIds}
          isIssuingDocument={issueMutation.isPending}
          canPrintDocument={canPrintDocument(roles)}
          canEditDocumentDraft={canEditDocumentDraft(roles)}
          canIssueRemito={canIssueRemito(roles)}
          canCloneBudgetToRemito={canCloneBudgetToRemito(roles)}
          canDuplicateDocument={canCreateDocumentDraft(roles)}
          canRegisterInCash={canRegisterInCash}
          canTransitionDocumentTo={(status) =>
            status === "EMITIDO"
              ? false
              : canTransitionDocumentTo(
                  roles,
                  status as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO",
                )
          }
        />

        <DataTablePagination
          page={documentsPagination.page}
          totalPages={documentsPagination.totalPages}
          totalItems={documents.length}
          rangeStart={documentsPagination.rangeStart}
          rangeEnd={documentsPagination.rangeEnd}
          pageSize={documentsPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setDocumentsPage}
          onPageSizeChange={(value) => setDocumentsPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
          itemLabel="documentos"
        />
      </div>

      {dialogOpen ? (
        <Suspense fallback={<DocumentsDialogLoader />}>
          <DocumentsEditorDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            editingDocId={editingDocId}
            documentForm={draftForm}
            setDraftForm={setDraftForm}
            lines={lines}
            setLines={setLines}
            totalDraft={totalDraft}
            customers={customers}
            technicians={technicians}
            serviceOptions={serviceOptions}
            priceLists={priceLists}
            availableItems={availableItems}
            combos={combos}
            onAddItem={onAddItem}
            onAddCombo={onAddCombo}
            onPriceListChange={onPriceListChange}
            removeLine={removeLine}
            onSubmit={() => upsertDraftMutation.mutate()}
            onResetDraftForm={resetDraftForm}
            isSubmitting={upsertDraftMutation.isPending || !canCreateDocumentDraft(roles)}
            sourceDocumentLabel={editingSourceDocumentLabel}
          />
        </Suspense>
      ) : null}

      {detailOpen ? (
        <Suspense fallback={<DocumentsDialogLoader />}>
          <DocumentsPreviewDialog
            open={detailOpen}
            onOpenChange={setDetailOpen}
            selectedDocument={selectedDocument}
            selectedLines={selectedLines}
            selectedEvents={selectedEvents}
            eventUserNamesById={eventUserNamesById}
            isExternalInvoiceLocked={selectedDocumentCashUsage}
            sourceDocumentLabel={sourceDocumentLabel}
            technicianName={
              selectedDocument?.technician_id
                ? allTechnicians.find((technician) => technician.id === selectedDocument.technician_id)?.name ?? "Tecnico eliminado"
                : null
            }
            serviceLinkLabel={
              selectedServiceOption
                ? `${selectedServiceOption.jobTitle} / ${selectedServiceOption.title}`
                : selectedDocument?.service_id ? "Servicio asociado" : null
            }
            onOpenService={
              selectedDocument?.service_id
                ? () => navigate(`/service-jobs?serviceId=${selectedDocument.service_id}`)
                : undefined
            }
            companySettings={companySettings}
            onSetExternalInvoice={(documentId, externalInvoiceNumber) => {
              setExternalInvoiceMutation.mutate({
                documentId,
                externalInvoiceNumber,
                externalInvoiceDate: null,
              });
            }}
            onClearExternalInvoice={(documentId) => {
              clearExternalInvoiceMutation.mutate(documentId);
            }}
            isUpdatingExternalInvoice={
              setExternalInvoiceMutation.isPending || clearExternalInvoiceMutation.isPending
            }
            canPrintDocument={canPrintDocument(roles)}
            onOpenPrint={(document) => {
              if (!canPrintDocument(roles)) return;
              void printDocument(document);
            }}
          onDuplicateDocument={(document) => {
              if (!canCreateDocumentDraft(roles)) return;
              setPendingAction({ kind: "duplicate", documentId: document.id, closePreview: true });
            }}
            isDuplicatingDocument={duplicateDocumentMutation.isPending}
            canDuplicateDocument={canCreateDocumentDraft(roles)}
            canRegisterInCash={canRegisterInCash}
            isRegisteredInCash={Boolean(selectedDocument && cashRegisteredDocumentIds.has(selectedDocument.id))}
            onRegisterInCash={(document) => {
              setDetailOpen(false);
              openRegisterInCash(document);
            }}
          />
        </Suspense>
      ) : null}

      <RegisterDocumentInCashDialog
        document={cashDocument}
        open={registerCashOpen}
        isSubmitting={registerCashMutation.isPending}
        isClosedBusinessDate={Boolean(cashDocument?.id === selectedDocId && selectedDocumentClosureClosed)}
        onOpenChange={(open) => {
          setRegisterCashOpen(open);
          if (!open) setCashDocument(null);
        }}
        onConfirm={(paymentMethod) => {
          if (!cashDocument) return;
          registerCashMutation.mutate({ document: cashDocument, paymentMethod });
        }}
      />

      <DocumentConfirmationDialog
        open={Boolean(pendingAction && confirmationCopy)}
        title={confirmationCopy?.title ?? "Confirmar accion"}
        description={confirmationCopy?.description ?? "Revisa la accion antes de continuar."}
        confirmLabel={confirmationCopy?.confirmLabel ?? "Confirmar"}
        tone={confirmationCopy?.tone}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onConfirm={confirmPendingAction}
      />

      <Dialog
        open={Boolean(shareDocument)}
        onOpenChange={(open) => {
          if (!open) {
            setShareDocument(null);
            setShareCustomerId("");
            setShareLink(null);
            setShareMessageText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compartir documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <section className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Link público seguro</p>
                  <p className="text-xs text-muted-foreground">{shareLink?.enabled ? "Activo" : shareLink ? "Revocado" : "No generado"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void ensureDocumentShareLink()} disabled={shareLinkLoading}>
                    <Link2 className="mr-2 h-4 w-4" /> {shareLinkLoading ? "Generando..." : "Generar link"}
                  </Button>
                  <Button type="button" variant="outline" disabled={!shareLink?.enabled} onClick={() => {
                    if (!shareLink) return;
                    void navigator.clipboard.writeText(buildPublicDocumentUrl(shareLink.token));
                    toast({ title: "Link copiado" });
                  }}>
                    <Copy className="mr-2 h-4 w-4" /> Copiar
                  </Button>
                  <Button type="button" variant="outline" disabled={!shareLink?.enabled} onClick={() => void revokeDocumentShareLink()}>
                    <Unlink className="mr-2 h-4 w-4" /> Revocar
                  </Button>
                </div>
              </div>
              {shareLink?.enabled ? <Input className="mt-3" readOnly value={buildPublicDocumentUrl(shareLink.token)} /> : null}
            </section>
            <div className="space-y-2">
              <Label>Contacto guardado</Label>
              <Select
                value={shareCustomerId}
                onValueChange={(customerId) => {
                  setShareCustomerId(customerId);
                  const customer = customers.find((entry) => entry.id === customerId);
                  setSharePhone(customer?.phone ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegir cliente o contacto" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}{customer.phone ? ` · ${customer.phone}` : " · sin teléfono"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-share-phone">Número de WhatsApp</Label>
              <Input
                id="document-share-phone"
                inputMode="tel"
                placeholder="Ej. 5491123456789"
                value={sharePhone}
                onChange={(event) => setSharePhone(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Podés elegir un contacto o escribir el número manualmente.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-share-message">Mensaje</Label>
              <Textarea
                id="document-share-message"
                rows={6}
                value={shareMessageText}
                onChange={(event) => setShareMessageText(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShareDocument(null);
                setShareCustomerId("");
                setShareLink(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={shareLinkLoading}
              onClick={async () => {
                const message = shareMessageText || await getDocumentShareMessage();
                if (!message) return;
                window.open(buildWhatsAppUrl({ phone: sharePhone, message }), "_blank", "noopener,noreferrer");
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
