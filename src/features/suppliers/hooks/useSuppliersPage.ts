import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSupplierQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import type {
  MappingColumnOption,
  MappingPreviewRow,
  MappingSelection,
} from "@/features/suppliers/components/ColumnMappingModal";
import type { PdfMappingSelection } from "@/features/suppliers/components/PdfMappingModal";
import { useSupplierImportFlow } from "@/features/suppliers/hooks/useSupplierImportFlow";
import { useSupplierOrderActions } from "@/features/suppliers/hooks/useSupplierOrderActions";
import { deleteSupplier, restoreSupplier, saveSupplier } from "@/features/suppliers/mutations";
import {
  fetchSupplierCatalogLines,
  fetchSupplierCatalogVersions,
  fetchSupplierCatalogs,
  fetchSuppliers,
} from "@/features/suppliers/queries";
import {
  buildSupplierFormState,
  createCatalogDialogState,
  createEmptySupplierForm,
  groupSupplierVersionsByCatalog,
} from "@/features/suppliers/state";
import type {
  CatalogImportLine,
  ExtractionReviewLine,
  NormalizeDiagnostics,
  OrderLine,
  ParsePdfProgress,
  Supplier,
  SupplierCatalog,
  SupplierCatalogVersion,
  SupplierFormState,
} from "@/features/suppliers/types";

const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_CATALOGS: SupplierCatalog[] = [];
const EMPTY_CATALOG_VERSIONS: SupplierCatalogVersion[] = [];
const EMPTY_CATALOG_LINES: CatalogImportLine[] = [];

type ToastFn = (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

type UseSuppliersPageOptions = {
  companyId: string | null | undefined;
  toast: ToastFn;
};

export function useSuppliersPage({
  companyId,
  toast,
}: UseSuppliersPageOptions) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderLine>>({});
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
  const [form, setForm] = useState<SupplierFormState>(createEmptySupplierForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("new");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [catalogUiTab, setCatalogUiTab] = useState<"carga" | "historial" | "catalogo">("catalogo");
  const [dropDetailOpen, setDropDetailOpen] = useState(false);
  const [lastDiagnostics, setLastDiagnostics] = useState<NormalizeDiagnostics | null>(null);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingModalColumns, setMappingModalColumns] = useState<MappingColumnOption[]>([]);
  const [mappingModalPreviewRows, setMappingModalPreviewRows] = useState<MappingPreviewRow[]>([]);
  const [mappingModalSuggested, setMappingModalSuggested] = useState<Omit<MappingSelection, "remember">>({
    descriptionColumn: "",
    priceColumn: "",
    currencyColumn: null,
    supplierCodeColumn: null,
  });
  const [mappingModalConfidence, setMappingModalConfidence] = useState(0);
  const [pdfMappingOpen, setPdfMappingOpen] = useState(false);
  const [pdfMappingHeaders, setPdfMappingHeaders] = useState<string[]>([]);
  const [pdfMappingRows, setPdfMappingRows] = useState<string[][]>([]);
  const [pdfMappingSuggested, setPdfMappingSuggested] = useState<Omit<PdfMappingSelection, "remember">>({
    descriptionColumn: "col_1",
    priceColumn: "col_2",
    codeColumn: null,
    preferPriceAtEnd: true,
    filterRowsWithoutPrice: true,
  });
  const [pdfProgress, setPdfProgress] = useState<ParsePdfProgress | null>(null);
  const [extractionReviewOpen, setExtractionReviewOpen] = useState(false);
  const [extractionReviewLines, setExtractionReviewLines] = useState<ExtractionReviewLine[]>([]);

  const xlsxMappingResolverRef = useRef<((value: MappingSelection | null) => void) | null>(null);
  const pdfMappingResolverRef = useRef<((value: PdfMappingSelection | null) => void) | null>(null);
  const qc = useQueryClient();
  const deferredSearch = useDeferredValue(search);
  const trimmedDeferredSearch = deferredSearch.trim();
  const deferredCatalogSearch = useDeferredValue(catalogSearch);
  const trimmedDeferredCatalogSearch = deferredCatalogSearch.trim();

  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliers.list(companyId ?? null, trimmedDeferredSearch, statusFilter),
    enabled: Boolean(companyId),
    queryFn: () => fetchSuppliers({
      companyId: companyId!,
      statusFilter,
      search: trimmedDeferredSearch,
    }),
  });

  const catalogsQuery = useQuery({
    queryKey: queryKeys.suppliers.catalogs(companyId ?? null, selectedSupplier?.id),
    enabled: Boolean(companyId && selectedSupplier),
    queryFn: () => fetchSupplierCatalogs(companyId!, selectedSupplier!.id),
  });

  const catalogVersionsQuery = useQuery({
    queryKey: queryKeys.suppliers.catalogVersions(companyId ?? null, selectedSupplier?.id),
    enabled: Boolean(companyId && selectedSupplier),
    queryFn: () => fetchSupplierCatalogVersions(companyId!, selectedSupplier!.id),
  });

  const activeCatalogLinesQuery = useQuery({
    queryKey: queryKeys.suppliers.catalogLines(companyId ?? null, activeVersionId, trimmedDeferredCatalogSearch),
    enabled: Boolean(companyId && activeVersionId),
    queryFn: () => fetchSupplierCatalogLines({
      companyId: companyId!,
      versionId: activeVersionId!,
      search: trimmedDeferredCatalogSearch,
    }),
  });

  const suppliers = suppliersQuery.data ?? EMPTY_SUPPLIERS;
  const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;
  const catalogVersions = catalogVersionsQuery.data ?? EMPTY_CATALOG_VERSIONS;
  const activeCatalogLines = activeCatalogLinesQuery.data ?? EMPTY_CATALOG_LINES;

  const catalogsById = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog])),
    [catalogs],
  );
  const catalogVersionsById = useMemo(
    () => new Map(catalogVersions.map((version) => [version.id, version])),
    [catalogVersions],
  );
  const catalogTitleById = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog.title])),
    [catalogs],
  );
  const activeVersion = useMemo(
    () => (activeVersionId ? catalogVersionsById.get(activeVersionId) ?? null : null),
    [activeVersionId, catalogVersionsById],
  );
  const versionsByCatalog = useMemo(
    () => groupSupplierVersionsByCatalog(catalogVersions),
    [catalogVersions],
  );

  const {
    closeMappingModal,
    closePdfMappingModal,
    confirmMappingModal,
    confirmPdfMappingModal,
    confirmImportMutation,
    uploadCatalogMutation,
  } = useSupplierImportFlow({
    currentCompanyId: companyId ?? null,
    selectedSupplier,
    selectedFile,
    selectedCatalogId,
    documentTitle,
    documentNotes,
    catalogsById,
    queryClient: qc,
    setDocumentTitle,
    setDocumentNotes,
    setSelectedCatalogId,
    setSelectedFile,
    setPdfProgress,
    setLastDiagnostics,
    setExtractionReviewOpen,
    setExtractionReviewLines,
    setActiveVersionId,
    setCatalogUiTab,
    setOrderItems,
    setLineQuantities,
    setMappingModalOpen,
    setMappingModalColumns,
    setMappingModalPreviewRows,
    setMappingModalSuggested,
    setMappingModalConfidence,
    setPdfMappingOpen,
    setPdfMappingHeaders,
    setPdfMappingRows,
    setPdfMappingSuggested,
    xlsxMappingResolverRef,
    pdfMappingResolverRef,
    toast,
  });

  const {
    addToOrder,
    copyOrderMessage,
    emailLink,
    openEmail,
    openWhatsApp,
    orderLines,
    orderTotalsByCurrency,
    removeOrderItem,
    updateLineQuantity,
    updateOrderQuantity,
  } = useSupplierOrderActions({
    selectedSupplier,
    activeVersion,
    catalogTitleById,
    orderItems,
    lineQuantities,
    setOrderItems,
    setLineQuantities,
    toast,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Necesitas una empresa activa para guardar proveedores.");
      await saveSupplier({
        companyId,
        form,
        editingId: editing?.id ?? null,
      });
    },
    onSuccess: async () => {
      await invalidateSupplierQueries(qc);
      setDialogOpen(false);
      setEditing(null);
      setForm(createEmptySupplierForm());
      setShowAdvanced(false);
      toast({ title: editing ? "Proveedor actualizado" : "Proveedor creado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo guardar el proveedor",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      if (!companyId) throw new Error("Necesitas una empresa activa para eliminar proveedores.");
      await deleteSupplier(companyId, supplierId);
    },
    onSuccess: async () => {
      await invalidateSupplierQueries(qc);
      toast({ title: "Proveedor eliminado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo eliminar el proveedor",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      if (!companyId) throw new Error("Necesitas una empresa activa para restaurar proveedores.");
      await restoreSupplier(companyId, supplierId);
    },
    onSuccess: async () => {
      await invalidateSupplierQueries(qc);
      toast({ title: "Proveedor restaurado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo restaurar el proveedor",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const resetCatalogDialogState = () => {
    const nextState = createCatalogDialogState();
    setCatalogSearch(nextState.catalogSearch);
    setActiveVersionId(nextState.activeVersionId);
    setOrderItems(nextState.orderItems);
    setLineQuantities(nextState.lineQuantities);
    setLastDiagnostics(nextState.lastDiagnostics);
    setPdfProgress(nextState.pdfProgress);
    setSelectedCatalogId(nextState.selectedCatalogId);
    setSelectedFile(nextState.selectedFile);
    setCatalogUiTab(nextState.catalogUiTab);
    setExtractionReviewOpen(false);
    setExtractionReviewLines([]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(createEmptySupplierForm());
    setShowAdvanced(false);
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm(buildSupplierFormState(supplier));
    setDialogOpen(true);
  };

  const openCatalog = (supplier: Supplier) => {
    resetCatalogDialogState();
    setSelectedSupplier(supplier);
    setCatalogDialogOpen(true);
  };

  const onCatalogDialogOpenChange = (open: boolean) => {
    setCatalogDialogOpen(open);
    if (!open) resetCatalogDialogState();
  };

  const onCatalogVersionSelect = (versionId: string) => {
    setActiveVersionId(versionId);
    setCatalogSearch("");
    setOrderItems({});
    setLineQuantities({});
    setCatalogUiTab("catalogo");
  };

  const onExtractionReviewLineChange = (lineId: string, patch: Partial<ExtractionReviewLine>) => {
    setExtractionReviewLines((previousLines) =>
      previousLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  };

  const onRemoveExtractionReviewLine = (lineId: string) => {
    setExtractionReviewLines((previousLines) => previousLines.filter((line) => line.id !== lineId));
  };

  return {
    activeCatalogLines,
    activeVersion,
    activeVersionId,
    addToOrder,
    catalogDialogOpen,
    catalogSearch,
    catalogTitleById,
    catalogUiTab,
    catalogs,
    closeMappingModal,
    closePdfMappingModal,
    confirmMappingModal,
    confirmPdfMappingModal,
    deleteMutation,
    dialogOpen,
    documentNotes,
    documentTitle,
    dropDetailOpen,
    editing,
    form,
    isCatalogLoading: activeCatalogLinesQuery.isLoading,
    isHistoryLoading: catalogVersionsQuery.isLoading,
    isLoading: suppliersQuery.isLoading,
    lastDiagnostics,
    lineQuantities,
    mappingModalColumns,
    mappingModalConfidence,
    mappingModalOpen,
    mappingModalPreviewRows,
    mappingModalSuggested,
    onCatalogDialogOpenChange,
    onCatalogVersionSelect,
    onCopyOrderMessage: copyOrderMessage,
    onConfirmExtractionImport: () => confirmImportMutation.mutate(extractionReviewLines),
    onExtractionReviewLineChange,
    onOpenEmail: openEmail,
    onOpenWhatsApp: openWhatsApp,
    onRemoveExtractionReviewLine,
    onRemoveOrderItem: removeOrderItem,
    onRestoreSupplier: (supplierId: string) => restoreMutation.mutate(supplierId),
    onUpdateLineQuantity: updateLineQuantity,
    onUpdateOrderQuantity: updateOrderQuantity,
    openCatalog,
    openCreate,
    openEdit,
    orderLines,
    orderTotalsByCurrency,
    pdfMappingHeaders,
    pdfMappingOpen,
    pdfMappingRows,
    pdfMappingSuggested,
    pdfProgress,
    extractionImportPending: confirmImportMutation.isPending,
    extractionReviewLines,
    extractionReviewOpen,
    confirmImportMutation,
    saveMutation,
    search,
    selectedCatalogId,
    selectedFile,
    selectedSupplier,
    supplierEmailLink: emailLink,
    setCatalogSearch,
    setCatalogUiTab,
    setDialogOpen,
    setDocumentNotes,
    setDocumentTitle,
    setDropDetailOpen,
    setExtractionReviewLines,
    setExtractionReviewOpen,
    setForm,
    setMappingModalOpen,
    setPdfMappingOpen,
    setSearch,
    setSelectedCatalogId,
    setSelectedFile,
    setShowAdvanced,
    setStatusFilter,
    setSupplierToDelete,
    showAdvanced,
    statusFilter,
    supplierToDelete,
    suppliers,
    uploadCatalogMutation,
    versionsByCatalog,
  };
}
