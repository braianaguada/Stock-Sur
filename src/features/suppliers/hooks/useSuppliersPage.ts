import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSupplierQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import { useSupplierOrderActions } from "@/features/suppliers/hooks/useSupplierOrderActions";
import {
  useCreateSupplierPurchaseOrder,
  useSupplierPurchaseOrders,
} from "@/features/purchase-orders/hooks";
import type { SupplierPurchaseOrder } from "@/features/purchase-orders/types";
import { deleteSupplier, restoreSupplier, saveSupplier } from "@/features/suppliers/mutations";
import {
  fetchSupplierCatalogLines,
  fetchSupplierCatalogVersions,
  fetchSupplierCatalogs,
  fetchSupplierReorderContext,
  fetchSuppliers,
} from "@/features/suppliers/queries";
import { buildSupplierReorderSuggestions } from "@/features/suppliers/reorderSuggestions";
import {
  buildSupplierFormState,
  createCatalogDialogState,
  createEmptySupplierForm,
  groupSupplierVersionsByCatalog,
  selectSupplierCatalogVersionId,
} from "@/features/suppliers/state";
import type {
  CatalogLine,
  OrderLine,
  Supplier,
  SupplierCatalog,
  SupplierCatalogVersion,
  SupplierFormState,
} from "@/features/suppliers/types";

const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_CATALOGS: SupplierCatalog[] = [];
const EMPTY_CATALOG_VERSIONS: SupplierCatalogVersion[] = [];
const EMPTY_CATALOG_LINES: CatalogLine[] = [];

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
  const [supplierContext, setSupplierContext] = useState<{ companyId: string; supplier: Supplier } | null>(null);
  const selectedSupplier = supplierContext && supplierContext.companyId === companyId ? supplierContext.supplier : null;
  const [catalogSearch, setCatalogSearch] = useState("");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderLine>>({});
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
  const [form, setForm] = useState<SupplierFormState>(createEmptySupplierForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogUiTab, setCatalogUiTab] = useState<"carga" | "historial" | "catalogo">("catalogo");
  const [lastPurchaseOrder, setLastPurchaseOrder] = useState<SupplierPurchaseOrder | null>(null);

  const qc = useQueryClient();
  const deferredSearch = useDeferredValue(search);
  const trimmedDeferredSearch = deferredSearch.trim();
  const deferredCatalogSearch = useDeferredValue(catalogSearch);
  const trimmedDeferredCatalogSearch = deferredCatalogSearch.trim();

  const resetCatalogDialogState = useCallback(() => {
    const nextState = createCatalogDialogState();
    setCatalogSearch(nextState.catalogSearch);
    setActiveVersionId(nextState.activeVersionId);
    setOrderItems(nextState.orderItems);
    setLineQuantities(nextState.lineQuantities);
    setCatalogUiTab(nextState.catalogUiTab);
    setLastPurchaseOrder(null);
  }, []);

  const previousCompanyIdRef = useRef(companyId ?? null);
  useEffect(() => {
    const nextCompanyId = companyId ?? null;
    if (previousCompanyIdRef.current === nextCompanyId) return;

    previousCompanyIdRef.current = nextCompanyId;
    setCatalogDialogOpen(false);
    setImportOpen(false);
    setSupplierContext(null);
    resetCatalogDialogState();
  }, [companyId, resetCatalogDialogState]);

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
    enabled: Boolean(companyId && selectedSupplier && activeVersionId),
    queryFn: () => fetchSupplierCatalogLines({
      companyId: companyId!,
      versionId: activeVersionId!,
      search: trimmedDeferredCatalogSearch,
    }),
  });
  const reorderContextQuery = useQuery({
    queryKey: queryKeys.suppliers.reorderSuggestions(companyId ?? null, activeVersionId),
    enabled: Boolean(companyId && selectedSupplier && activeVersionId && catalogDialogOpen),
    queryFn: () => fetchSupplierReorderContext({
      companyId: companyId!,
      versionId: activeVersionId!,
    }),
  });
  const purchaseOrdersQuery = useSupplierPurchaseOrders(
    selectedSupplier ? companyId ?? null : null,
    selectedSupplier?.id,
  );
  const createPurchaseOrderMutation = useCreateSupplierPurchaseOrder();

  const suppliers = suppliersQuery.data ?? EMPTY_SUPPLIERS;
  const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;
  const catalogVersions = catalogVersionsQuery.data ?? EMPTY_CATALOG_VERSIONS;
  const activeCatalogLines = activeCatalogLinesQuery.data ?? EMPTY_CATALOG_LINES;
  const reorderSuggestions = useMemo(
    () => reorderContextQuery.data
      ? buildSupplierReorderSuggestions(
        reorderContextQuery.data.lines,
        reorderContextQuery.data.stockRows,
      )
      : [],
    [reorderContextQuery.data],
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

  useEffect(() => {
    if (!catalogDialogOpen || !selectedSupplier || catalogVersionsQuery.isLoading) return;

    setActiveVersionId((currentVersionId) =>
      selectSupplierCatalogVersionId(catalogVersions, currentVersionId),
    );
  }, [
    catalogDialogOpen,
    catalogVersions,
    catalogVersionsQuery.isLoading,
    selectedSupplier,
  ]);

  const {
    addToOrder,
    addSuggestionsToOrder,
    copyOrderMessage,
    emailLink,
    goToPurchaseOrder,
    goToPurchaseOrders,
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
      await invalidateSupplierQueries(qc, companyId!);
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
      await invalidateSupplierQueries(qc, companyId!);
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
      await invalidateSupplierQueries(qc, companyId!);
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
    setSupplierContext(companyId ? { companyId, supplier } : null);
    setCatalogDialogOpen(true);
  };

  const onCatalogDialogOpenChange = (open: boolean) => {
    setCatalogDialogOpen(open);
    if (!open) {
      setSupplierContext(null);
      resetCatalogDialogState();
    }
  };

  const onCatalogVersionSelect = (versionId: string) => {
    setActiveVersionId(versionId);
    setCatalogSearch("");
    setOrderItems({});
    setLineQuantities({});
    setCatalogUiTab("catalogo");
  };

  const onCreatePurchaseOrder = () => {
    if (!companyId || !selectedSupplier || !activeVersionId || orderLines.length === 0) return;
    createPurchaseOrderMutation.mutate({
      companyId,
      supplierId: selectedSupplier.id,
      catalogVersionId: activeVersionId,
      lines: orderLines.map((line) => ({ catalogLineId: line.id, quantity: line.quantity })),
    }, {
      onSuccess: (order) => {
        setLastPurchaseOrder(order);
        setOrderItems({});
        setLineQuantities({});
        toast({ title: `Orden #${order.order_number} generada` });
      },
      onError: (error: unknown) => toast({
        title: "No se pudo generar la orden",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      }),
    });
  };

  return {
    activeCatalogLines,
    activeVersion,
    activeVersionId,
    addToOrder,
    addSuggestionsToOrder,
    catalogDialogOpen: catalogDialogOpen && Boolean(selectedSupplier),
    catalogSearch,
    catalogTitleById,
    catalogUiTab,
    catalogs,
    importOpen: importOpen && Boolean(selectedSupplier),
    startImport: () => { setCatalogDialogOpen(false); setImportOpen(true); },
    cancelImport: () => { setImportOpen(false); setCatalogDialogOpen(true); },
    finishImport: (versionId: string) => {
      setImportOpen(false);
      setActiveVersionId(versionId);
      setCatalogSearch("");
      setOrderItems({});
      setLineQuantities({});
      setCatalogUiTab("catalogo");
      setCatalogDialogOpen(true);
      toast({ title: "Lista importada", description: "Precios guardados sin IVA." });
    },
    deleteMutation,
    dialogOpen,
    editing,
    form,
    goToPurchaseOrder,
    goToPurchaseOrders,
    isCatalogLoading: activeCatalogLinesQuery.isLoading,
    isReorderSuggestionsLoading: reorderContextQuery.isLoading,
    isHistoryLoading: catalogVersionsQuery.isLoading,
    isLoading: suppliersQuery.isLoading,
    lineQuantities,
    onCatalogDialogOpenChange,
    onCatalogVersionSelect,
    onCopyOrderMessage: copyOrderMessage,
    onOpenEmail: openEmail,
    onOpenWhatsApp: openWhatsApp,
    onRemoveOrderItem: removeOrderItem,
    onRestoreSupplier: (supplierId: string) => restoreMutation.mutate(supplierId),
    onUpdateLineQuantity: updateLineQuantity,
    onUpdateOrderQuantity: updateOrderQuantity,
    openCatalog,
    openCreate,
    openEdit,
    orderLines,
    orderTotalsByCurrency,
    purchaseOrders: purchaseOrdersQuery.data ?? [],
    reorderSuggestions,
    isPurchaseOrdersLoading: purchaseOrdersQuery.isLoading,
    isCreatingPurchaseOrder: createPurchaseOrderMutation.isPending,
    lastPurchaseOrder,
    onCreatePurchaseOrder,
    saveMutation,
    search,
    selectedSupplier,
    supplierEmailLink: emailLink,
    setCatalogSearch,
    setCatalogUiTab,
    setDialogOpen,
    setForm,
    setSearch,
    setShowAdvanced,
    setStatusFilter,
    setSupplierToDelete,
    showAdvanced,
    statusFilter,
    supplierToDelete,
    suppliers,
    versionsByCatalog,
  };
}
