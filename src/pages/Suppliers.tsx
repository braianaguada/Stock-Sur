import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSupplier } from "@/features/suppliers/queries";
import { useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { useSupplierPurchasing } from "@/features/suppliers/hooks/useSupplierPurchasing";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterToolbar, PageContainer, PageHeader, PageTabs } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SuppliersTable } from "@/features/suppliers/components/SuppliersTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { useSuppliersPage } from "@/features/suppliers/hooks/useSuppliersPage";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { SupplierCurrencyToolbar } from "@/features/suppliers/components/SupplierCurrencyToolbar";
import { useSupplierExchangeRate } from "@/features/suppliers/hooks/useSupplierExchangeRate";
import { SupplierListProducts } from "@/features/suppliers/components/SupplierListProducts";

const SupplierFormDialog = lazy(() => import("@/features/suppliers/components/SupplierFormDialog").then((module) => ({ default: module.SupplierFormDialog })));
const SupplierExcelImport = lazy(() => import("@/features/suppliers/components/SupplierExcelImport").then((module) => ({ default: module.SupplierExcelImport })));
const SupplierListsComparison = lazy(() => import("@/features/suppliers/components/SupplierListsComparison").then((module) => ({ default: module.SupplierListsComparison })));

function SuppliersWorkspace({ companyId }: { companyId?: string }) {
  const { toast } = useToast();
  const model = useSuppliersPage({ companyId, toast });
  const purchasing = useSupplierPurchasing();
  const [searchParams, setSearchParams] = useSearchParams();
  const [comparisonVersionId, setComparisonVersionId] = useState("");
  const [view, setView] = useState("suppliers");
  const currency = purchasing?.currency ?? "ARS";
  const setCurrency = purchasing?.setCurrency ?? (() => undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const exchange = useSupplierExchangeRate(companyId);
  const pagination = usePaginationSlice({ items: model.suppliers, page, pageSize });
  const supplier = model.selectedSupplier;
  useEffect(() => setPage(1), [model.search, model.statusFilter]);
  const addItem = purchasing?.addItem ?? (() => undefined);
  const requestedSupplierId = searchParams.get("supplier");
  const requestedVersionId = searchParams.get("list");
  const openedRequest = useRef<string | null>(null);
  const requestedSupplier = useQuery({
    queryKey: ["supplier-pricing", companyId, requestedSupplierId],
    queryFn: () => fetchSupplier(companyId!, requestedSupplierId!),
    enabled: Boolean(companyId && requestedSupplierId),
  });
  useEffect(() => {
    if (!requestedSupplierId) { openedRequest.current = null; return; }
    const selected = requestedSupplier.data;
    if (!selected || !selected.is_active) return;
    const request = `${requestedSupplierId}:${requestedVersionId}`;
    if (openedRequest.current !== request) {
      openedRequest.current = request;
      model.openCatalog(selected);
      setView("suppliers");
      return;
    }
    if (supplier?.id === selected.id && !model.isHistoryLoading) {
      if (requestedVersionId && Object.values(model.versionsByCatalog).flat().some((version) => version.id === requestedVersionId)) model.onCatalogVersionSelect(requestedVersionId);
      setSearchParams({}, { replace: true });
    }
  }, [requestedSupplierId, requestedVersionId, requestedSupplier.data, model, supplier, setSearchParams]);
  const importView = model.importOpen && supplier && companyId ? <Suspense fallback={<p className="p-8">Cargando importación…</p>}><SupplierExcelImport key={companyId + supplier.id} companyId={companyId} supplier={supplier} catalogs={model.catalogs} catalogsLoading={model.catalogsLoading} catalogsError={model.catalogsError} onRetryCatalogs={model.retryCatalogs} onCancel={model.cancelImport} onImported={model.finishImport} /></Suspense> : null;
  const currencyToolbar = <SupplierCurrencyToolbar embedded currency={currency} onCurrencyChange={setCurrency} />;
  return <AppLayout>
    {importView}<PageContainer archetype="workspace" className="page-shell">
    {!companyId ? <CompanyAccessNotice description="Necesitás una empresa activa para trabajar con proveedores." /> : null}
    {requestedSupplier.error ? <p role="alert">No se pudo abrir el proveedor solicitado. <Button variant="link" onClick={() => void requestedSupplier.refetch()}>Reintentar</Button></p> : null}
    <PageHeader variant="workspace" eyebrow="Compras" title="Proveedores" actions={view === "suppliers" ? <Button disabled={!companyId} onClick={model.openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo proveedor</Button> : undefined} />
    <PageTabs tabs={[{ value: "suppliers", label: "Proveedores y listas" }, { value: "comparison", label: "Comparar listas" }]} value={view} onValueChange={setView} />
    {companyId && view === "comparison" ? <Suspense fallback={<p>Cargando comparación…</p>}><SupplierListsComparison key={`${companyId}:${comparisonVersionId}`} initialVersionId={comparisonVersionId} companyId={companyId} currency={currency} rate={exchange.data?.rate} onAdd={addItem} toolbar={currencyToolbar} /></Suspense> : null}
    {model.catalogDialogOpen && supplier ? <EntityDialog open onOpenChange={model.onCatalogDialogOpenChange} title={supplier.name} contentClassName="max-w-[min(96vw,1360px)]"><div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{model.catalogs.length} listas disponibles</span><Button variant="outline" disabled={!model.activeVersionId} onClick={() => { setComparisonVersionId(model.activeVersionId ?? ""); model.onCatalogDialogOpenChange(false); setView("comparison"); }}>Comparar listas</Button></div>
      {currencyToolbar}
      <dl className="flex flex-wrap gap-5 text-sm"><div className="flex gap-2"><dt className="text-muted-foreground">IVA</dt><dd className="font-medium">{supplier.vat_rate ?? 21}%</dd></div><div className="flex gap-2"><dt className="text-muted-foreground">Flete</dt><dd className="font-medium">{supplier.freight_rate ?? 0}%</dd></div></dl>
      <Select value={model.activeVersionId ?? ""} onValueChange={model.onCatalogVersionSelect}><SelectTrigger aria-label="Lista de precios del proveedor" className="w-full min-w-0"><SelectValue placeholder="Elegir lista de precios" /></SelectTrigger><SelectContent>{model.catalogs.map((catalog) => {
        const latest = model.versionsByCatalog[catalog.id]?.[0];
        return latest ? <SelectItem key={catalog.id} value={latest.id}>{catalog.title} ({latest.line_count} productos)</SelectItem> : null;
      })}</SelectContent></Select>
      {!model.isHistoryLoading && !model.catalogs.length ? <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Este proveedor todavía no tiene listas. Cargá un Excel para empezar.</p> : null}
      <FilterToolbar><div className="w-full sm:max-w-md"><Input aria-label="Buscar productos de la lista" placeholder="Buscar productos en esta lista" value={model.catalogSearch} onChange={(event) => model.setCatalogSearch(event.target.value)} /></div></FilterToolbar>
      {model.catalogError ? <p role="alert" className="text-destructive">No se pudo cargar la lista: {model.catalogError.message}</p> : null}
      {model.activeVersion && <SupplierListProducts key={`${model.activeVersion.id}:${model.catalogSearch}`} supplier={supplier} lines={model.activeCatalogLines} currency={currency} rate={exchange.data?.rate} loading={model.isCatalogLoading} onAdd={(line, quantity) => addItem({ supplierId: supplier.id, versionId: model.activeVersion!.id, listName: model.catalogTitleById.get(model.activeVersion!.catalog_id) ?? "Lista", line, quantity })} />}
    </div></EntityDialog> : null}
    {view === "suppliers" ? <>
      <FilterToolbar><div className="relative w-full md:max-w-sm"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar proveedores" placeholder="Buscar por nombre, contacto o email" className="pl-9" value={model.search} onChange={(event) => model.setSearch(event.target.value)} /></div><Select value={model.statusFilter} onValueChange={(value) => model.setStatusFilter(value as "active" | "inactive" | "all")}><SelectTrigger className="w-full md:w-56" aria-label="Filtrar proveedores por estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select></FilterToolbar>
      {model.suppliersError ? <p role="alert" className="text-destructive">No se pudieron cargar los proveedores: {model.suppliersError.message}</p> : null}
      <SuppliersTable suppliers={pagination.pagedItems} isLoading={model.isLoading} onOpenCatalog={model.openCatalog} onUpload={model.openImport} onOpenEdit={model.openEdit} onDelete={model.setSupplierToDelete} onRestore={model.onRestoreSupplier} />
      <DataTablePagination {...pagination} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} itemLabel="proveedores" />
    </> : null}
    {model.dialogOpen ? <Suspense fallback={<p>Cargando formulario…</p>}><SupplierFormDialog open editingName={model.editing?.name} form={model.form} showAdvanced={model.showAdvanced} isSaving={model.saveMutation.isPending} onOpenChange={model.setDialogOpen} onShowAdvancedChange={model.setShowAdvanced} onFormChange={model.setForm} onSubmit={() => model.saveMutation.mutate()} /></Suspense> : null}
    <ConfirmDeleteDialog open={!!model.supplierToDelete} onOpenChange={(open) => { if (!open) model.setSupplierToDelete(null); }} title="Eliminar proveedor" description={`Se eliminará al proveedor "${model.supplierToDelete?.name ?? ""}".`} isPending={model.deleteMutation.isPending} onConfirm={() => { if (model.supplierToDelete) model.deleteMutation.mutate(model.supplierToDelete.id); }} />
  </PageContainer></AppLayout>;
}

export default function SuppliersPage() {
  const { currentCompany } = useAuth();
  return <SuppliersWorkspace key={currentCompany?.id ?? "no-company"} companyId={currentCompany?.id} />;
}
