import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSupplierQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
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
  selectSupplierCatalogVersionId,
} from "@/features/suppliers/state";
import type {
  CatalogLine,
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
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
  const [form, setForm] = useState<SupplierFormState>(createEmptySupplierForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogUiTab, setCatalogUiTab] = useState<"carga" | "historial" | "catalogo">("catalogo");

  const qc = useQueryClient();
  const deferredSearch = useDeferredValue(search);
  const trimmedDeferredSearch = deferredSearch.trim();
  const deferredCatalogSearch = useDeferredValue(catalogSearch);
  const trimmedDeferredCatalogSearch = deferredCatalogSearch.trim();

  const resetCatalogDialogState = useCallback(() => {
    const nextState = createCatalogDialogState();
    setCatalogSearch(nextState.catalogSearch);
    setActiveVersionId(nextState.activeVersionId);
    setLineQuantities(nextState.lineQuantities);
    setCatalogUiTab(nextState.catalogUiTab);
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
  const suppliers = suppliersQuery.data ?? EMPTY_SUPPLIERS;
  const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;
  const catalogVersions = catalogVersionsQuery.data ?? EMPTY_CATALOG_VERSIONS;
  const activeCatalogLines = activeCatalogLinesQuery.data ?? EMPTY_CATALOG_LINES;
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
      await qc.invalidateQueries({ queryKey: ["supplier-comparison-versions", companyId] });
      await qc.invalidateQueries({ queryKey: ["supplier-pricing", companyId] });
      if (editing && selectedSupplier?.id === editing.id) setSupplierContext({ companyId: companyId!, supplier: { ...editing, ...form, vat_rate: Number(form.vat_rate ?? 21), freight_rate: Number(form.freight_rate ?? 0) } });
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
      await qc.invalidateQueries({ queryKey: ["supplier-comparison-versions", companyId] });
      await qc.invalidateQueries({ queryKey: ["supplier-pricing", companyId] });
      toast({ title: "Proveedor eliminado" });
      setSupplierToDelete(null);
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
      await qc.invalidateQueries({ queryKey: ["supplier-comparison-versions", companyId] });
      await qc.invalidateQueries({ queryKey: ["supplier-pricing", companyId] });
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
    setLineQuantities({});
    setCatalogUiTab("catalogo");
  };

  return {
    activeCatalogLines,
    activeVersion,
    activeVersionId,
    catalogDialogOpen: catalogDialogOpen && Boolean(selectedSupplier),
    catalogSearch,
    catalogTitleById,
    catalogUiTab,
    catalogs,
    catalogsLoading: catalogsQuery.isLoading,
    catalogsError: catalogsQuery.error,
    retryCatalogs: () => { void catalogsQuery.refetch(); },
    importOpen: importOpen && Boolean(selectedSupplier),
    startImport: () => { setCatalogDialogOpen(false); setImportOpen(true); },
    openImport: (supplier: Supplier) => {
      resetCatalogDialogState();
      setSupplierContext(companyId ? { companyId, supplier } : null);
      setCatalogDialogOpen(false);
      setImportOpen(true);
    },
    cancelImport: () => { setImportOpen(false); setCatalogDialogOpen(true); },
    finishImport: (versionId: string) => {
      setImportOpen(false);
      setActiveVersionId(versionId);
      setCatalogSearch("");
      setLineQuantities({});
      setCatalogUiTab("catalogo");
      setCatalogDialogOpen(true);
      toast({ title: "Lista importada", description: "Precios guardados sin IVA." });
    },
    deleteMutation,
    dialogOpen,
    editing,
    form,
    catalogError: activeCatalogLinesQuery.error ?? catalogsQuery.error ?? catalogVersionsQuery.error,
    suppliersError: suppliersQuery.error,
    isCatalogLoading: activeCatalogLinesQuery.isLoading,
    isHistoryLoading: catalogsQuery.isLoading || catalogVersionsQuery.isLoading,
    isLoading: suppliersQuery.isLoading,
    lineQuantities,
    onCatalogDialogOpenChange,
    onCatalogVersionSelect,
    onRestoreSupplier: (supplierId: string) => restoreMutation.mutate(supplierId),
    onUpdateLineQuantity: (id: string, value: string) => setLineQuantities((current) => ({ ...current, [id]: Math.max(1, Math.trunc(Number(value) || 1)) })),
    openCatalog,
    openCreate,
    openEdit,
    saveMutation,
    search,
    selectedSupplier,
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
