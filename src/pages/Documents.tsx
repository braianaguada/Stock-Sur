import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "@/hooks/useSearch";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { getErrorMessage } from "@/lib/errors";
import {
  canCloneBudgetToRemito,
  canCreateDocumentDraft,
  canEditDocumentDraft,
  canIssueRemito,
  canPrintDocument,
  canTransitionDocumentTo,
} from "@/lib/permissions";
import { openPrintWindow } from "@/lib/print";
import { Plus, Search } from "lucide-react";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { EMPTY_LINE } from "@/features/documents/constants";
import { DocumentsDataTable } from "@/features/documents/components/DocumentsDataTable";
import { useDocumentsData } from "@/features/documents/hooks/useDocumentsData";
import { useDocumentDraftLoader } from "@/features/documents/hooks/useDocumentDraftLoader";
import { useDocumentsMutations } from "@/features/documents/hooks/useDocumentsMutations";
import { buildDocumentLineFromItem } from "@/features/documents/lib/buildDocumentLineFromItem";
import { mergeComboDocumentLines } from "@/features/documents/lib/mergeComboDocumentLines";
import { DUPLICATE_DOCUMENT_CONFIRMATION } from "@/features/documents/lib/duplicate";
import { buildDocumentPrintHtml } from "@/features/documents/print";
import type {
  CustomerKind,
  DocLineRow,
  DocRow,
  DocStatus,
  DocType,
  DocumentFormState,
  InternalRemitoType,
  LineDraft,
  PriceListItemRow,
} from "@/features/documents/types";
import { formatNumber } from "@/features/documents/utils";
import { buildComboLines } from "@/features/combos/lib/buildComboLines";
import { roundPrice } from "@/features/pricing/rounding";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

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
    doc_type: "PRESUPUESTO",
    point_of_sale: defaultPointOfSale,
    customer_id: defaultCustomerId,
    technician_id: "",
    service_id: "",
    customer_name: "",
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
  const { user, roles, currentCompany } = useAuth();
  const { toast } = useToast();
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
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
    selectedDocument,
    sourceDocumentLabel,
    combos,
    comboLinesByComboId,
  } = useDocumentsData({
    search: trimmedSearch,
    typeFilter,
    statusFilter,
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
  const defaultCustomerId = useMemo(
    () => customers.find((customer) => customer.name.trim().toLowerCase() === "cliente ocasional")?.id ?? "",
    [customers],
  );
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
  }, [trimmedSearch, typeFilter, statusFilter, documentsPageSize]);

  useEffect(() => {
    if (draftForm.price_list_id || priceLists.length === 0) return;
    setDraftForm((previousForm) => ({ ...previousForm, price_list_id: priceLists[0].id }));
  }, [draftForm.price_list_id, priceLists]);

  useEffect(() => {
    if (draftForm.customer_id || !defaultCustomerId) return;
    setDraftForm((previousForm) => ({ ...previousForm, customer_id: defaultCustomerId }));
  }, [defaultCustomerId, draftForm.customer_id]);

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
    setDraftForm(buildEmptyDocumentForm(defaultPointOfSale, defaultCustomerId));
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
      const confirmed = window.confirm(
        "Cambiar la lista va a eliminar todas las lineas cargadas para evitar mezclar productos y precios. Queres continuar?",
      );
      if (!confirmed) return;
    }

    setDraftForm((previousForm) => ({ ...previousForm, price_list_id: priceListId }));
    setLines([]);
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
        </FilterBar>

        <DocumentsDataTable
          documents={documentsPagination.pagedItems}
          isLoading={isLoading}
          pageSize={documentsPageSize}
          onOpenDetail={(documentId) => {
            setSelectedDocId(documentId);
            setDetailOpen(true);
          }}
          onPrint={(document) => {
            if (!canPrintDocument(roles)) return;
            void printDocument(document);
          }}
          onEditDraft={openEditDialog}
          onTransition={(documentId, targetStatus) => {
            const status = targetStatus as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO";
            if (!canTransitionDocumentTo(roles, status)) return;
            if (status === "ANULADO") {
              const confirmed = window.confirm("Vas a anular este documento. Esta accion no se puede deshacer.");
              if (!confirmed) return;
            }
            transitionMutation.mutate({ documentId, targetStatus: status });
          }}
          onIssueRemito={(documentId) => {
            if (!canIssueRemito(roles)) return;
            const document = documentsById.get(documentId);
            const confirmed = window.confirm(
              document?.doc_type === "REMITO_DEVOLUCION"
                ? "Vas a emitir esta devolucion. Se registrara ingreso de stock por las cantidades cargadas."
                : "Vas a emitir este remito. Verificá stock, cliente y líneas antes de continuar.",
            );
            if (!confirmed) return;
            issueMutation.mutate(documentId);
          }}
          onCloneAsRemito={(documentId) => {
            if (!canCloneBudgetToRemito(roles)) return;
            cloneAsRemitoMutation.mutate(documentId);
          }}
          onDuplicateDocument={(documentId) => {
            if (!canCreateDocumentDraft(roles)) return;
            const confirmed = window.confirm(DUPLICATE_DOCUMENT_CONFIRMATION);
            if (!confirmed) return;
            duplicateDocumentMutation.mutate(documentId, {
              onSuccess: (newDocumentId) => {
                setSelectedDocId(newDocumentId);
                setDetailOpen(true);
              },
            });
          }}
          onGenerateReturn={(documentId) => {
            const confirmed = window.confirm("Vas a generar una devolucion desde este remito. Confirmá que corresponde.");
            if (!confirmed) return;
            cloneAsReturnMutation.mutate(documentId);
          }}
          isIssuingDocument={issueMutation.isPending}
          canPrintDocument={canPrintDocument(roles)}
          canEditDocumentDraft={canEditDocumentDraft(roles)}
          canIssueRemito={canIssueRemito(roles)}
          canCloneBudgetToRemito={canCloneBudgetToRemito(roles)}
          canDuplicateDocument={canCreateDocumentDraft(roles)}
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
                ? technicians.find((technician) => technician.id === selectedDocument.technician_id)?.name ?? null
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
              const confirmed = window.confirm(DUPLICATE_DOCUMENT_CONFIRMATION);
              if (!confirmed) return;
              duplicateDocumentMutation.mutate(document.id, {
                onSuccess: (newDocumentId) => {
                  setSelectedDocId(newDocumentId);
                  setDetailOpen(true);
                },
              });
            }}
            isDuplicatingDocument={duplicateDocumentMutation.isPending}
            canDuplicateDocument={canCreateDocumentDraft(roles)}
          />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}
