import { Suspense, lazy, useEffect, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
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
import { addSupplierCartItem, type SupplierCartItem, type DisplayCurrency } from "@/features/suppliers/pricing";

const SupplierFormDialog = lazy(() => import("@/features/suppliers/components/SupplierFormDialog").then((module) => ({ default: module.SupplierFormDialog })));
const SupplierExcelImport = lazy(() => import("@/features/suppliers/components/SupplierExcelImport").then((module) => ({ default: module.SupplierExcelImport })));
const SupplierListsComparison = lazy(() => import("@/features/suppliers/components/SupplierListsComparison").then((module) => ({ default: module.SupplierListsComparison })));
const SupplierCart = lazy(() => import("@/features/suppliers/components/SupplierCart").then((module) => ({ default: module.SupplierCart })));

function SuppliersWorkspace({ companyId }: { companyId?: string }) {
  const { toast } = useToast();
  const model = useSuppliersPage({ companyId, toast });
  const [view, setView] = useState("suppliers");
  const [currency, setCurrency] = useState<DisplayCurrency>("ARS");
  const [items, setItems] = useState<SupplierCartItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const exchange = useSupplierExchangeRate(companyId);
  const pagination = usePaginationSlice({ items: model.suppliers, page, pageSize });
  const supplier = model.selectedSupplier;
  useEffect(() => setPage(1), [model.search, model.statusFilter]);
  const addItem = (item: SupplierCartItem) => {
    setItems((current) => addSupplierCartItem(current, item));
    toast({ title: "Producto agregado al carrito", description: item.line.raw_description });
  };
  const importView = model.importOpen && supplier && companyId ? <Suspense fallback={<p className="p-8">Cargando importación…</p>}><SupplierExcelImport key={companyId + supplier.id} companyId={companyId} supplier={supplier} catalogs={model.catalogs} onCancel={model.cancelImport} onImported={model.finishImport} /></Suspense> : null;
  return <>{importView}<div className={importView ? "hidden" : undefined}><PageContainer archetype="workspace" className="page-shell">
    {!companyId ? <CompanyAccessNotice description="Necesitás una empresa activa para trabajar con proveedores." /> : null}
    <PageHeader variant="workspace" eyebrow="Compras" title={view === "suppliers" && supplier ? supplier.name : "Proveedores"} actions={view === "suppliers" && supplier ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => model.openEdit(supplier)}>Configurar proveedor</Button><Button disabled={!supplier.is_active || model.isHistoryLoading} onClick={model.startImport}>Cargar lista Excel</Button></div> : view === "suppliers" ? <Button disabled={!companyId} onClick={model.openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo proveedor</Button> : undefined} />
    <PageTabs tabs={[{ value: "suppliers", label: "Proveedores y listas" }, { value: "comparison", label: "Comparar listas" }, { value: "cart", label: `Carrito (${items.length})` }]} value={view} onValueChange={setView} />
    {companyId && (view !== "suppliers" || supplier) ? <SupplierCurrencyToolbar currency={currency} onCurrencyChange={setCurrency} exchange={exchange} /> : null}
    {companyId && view === "comparison" ? <Suspense fallback={<p>Cargando comparación…</p>}><SupplierListsComparison key={companyId} companyId={companyId} currency={currency} rate={exchange.data?.rate} onAdd={addItem} /></Suspense> : null}
    {companyId && items.length > 0 ? <div className={view === "cart" ? undefined : "hidden"}><Suspense fallback={<p>Cargando carrito…</p>}><SupplierCart companyId={companyId} currency={currency} rate={exchange.data?.rate} items={items} onUpdate={(id, quantity) => setItems((current) => current.map((item) => item.line.id === id ? { ...item, quantity } : item))} onRemove={(id) => setItems((current) => current.filter((item) => item.line.id !== id))} onCreated={(supplierId) => { setItems((current) => current.filter((item) => item.supplierId !== supplierId)); toast({ title: "Orden de compra creada", description: "Podés revisarla en Órdenes de compra." }); }} /></Suspense></div> : companyId && view === "cart" ? <p className="p-8 text-center text-muted-foreground">Agregá productos desde las listas o la comparación.</p> : null}
    {view === "suppliers" && supplier ? <div className="space-y-4">
      <Button variant="ghost" onClick={() => model.onCatalogDialogOpenChange(false)}><ArrowLeft className="mr-2 h-4 w-4" />Todos los proveedores</Button>
      <p className="text-sm text-muted-foreground">IVA {supplier.vat_rate ?? 21}% · Flete {supplier.freight_rate ?? 0}% sobre neto. Cada lista muestra su última carga; los precios originales se conservan.</p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{model.catalogs.map((catalog) => {
        const latest = model.versionsByCatalog[catalog.id]?.[0];
        return <Button key={catalog.id} variant={latest?.id === model.activeVersionId ? "default" : "outline"} className="h-auto min-w-0 justify-start whitespace-normal p-3 text-left" disabled={!latest} onClick={() => latest && model.onCatalogVersionSelect(latest.id)}><span className="min-w-0"><span className="block break-words font-semibold">{catalog.title}</span><span className="block text-xs opacity-80">{latest ? `${latest.line_count} productos · ${new Date(latest.imported_at).toLocaleDateString("es-AR")}` : "Sin productos"}</span></span></Button>;
      })}</div>
      {!model.isHistoryLoading && !model.catalogs.length ? <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Este proveedor todavía no tiene listas. Cargá un Excel para empezar.</p> : null}
      <FilterToolbar><div className="w-full sm:max-w-md"><Input aria-label="Buscar productos de la lista" placeholder="Buscar productos en esta lista" value={model.catalogSearch} onChange={(event) => model.setCatalogSearch(event.target.value)} /></div><span className="text-sm text-muted-foreground">{model.activeVersion ? model.catalogTitleById.get(model.activeVersion.catalog_id) : "Seleccioná una lista"}</span></FilterToolbar>
      {model.catalogError ? <p role="alert" className="text-destructive">No se pudo cargar la lista: {model.catalogError.message}</p> : null}
      {model.activeVersion && <SupplierListProducts key={`${model.activeVersion.id}:${model.catalogSearch}`} supplier={supplier} lines={model.activeCatalogLines} currency={currency} rate={exchange.data?.rate} loading={model.isCatalogLoading} onAdd={(line, quantity) => addItem({ supplierId: supplier.id, versionId: model.activeVersion!.id, listName: model.catalogTitleById.get(model.activeVersion!.catalog_id) ?? "Lista", line, quantity })} />}
    </div> : view === "suppliers" ? <>
      <FilterToolbar><div className="relative w-full md:max-w-sm"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar proveedores" placeholder="Buscar por nombre, contacto o email" className="pl-9" value={model.search} onChange={(event) => model.setSearch(event.target.value)} /></div><Select value={model.statusFilter} onValueChange={(value) => model.setStatusFilter(value as "active" | "inactive" | "all")}><SelectTrigger className="w-full md:w-56" aria-label="Filtrar proveedores por estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select></FilterToolbar>
      {model.suppliersError ? <p role="alert" className="text-destructive">No se pudieron cargar los proveedores: {model.suppliersError.message}</p> : null}
      <SuppliersTable suppliers={pagination.pagedItems} isLoading={model.isLoading} onOpenCatalog={model.openCatalog} onOpenEdit={model.openEdit} onDelete={model.setSupplierToDelete} onRestore={model.onRestoreSupplier} />
      <DataTablePagination {...pagination} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} itemLabel="proveedores" />
    </> : null}
    {model.dialogOpen ? <Suspense fallback={<p>Cargando formulario…</p>}><SupplierFormDialog open editingName={model.editing?.name} form={model.form} showAdvanced={model.showAdvanced} isSaving={model.saveMutation.isPending} onOpenChange={model.setDialogOpen} onShowAdvancedChange={model.setShowAdvanced} onFormChange={model.setForm} onSubmit={() => model.saveMutation.mutate()} /></Suspense> : null}
    <ConfirmDeleteDialog open={!!model.supplierToDelete} onOpenChange={(open) => { if (!open) model.setSupplierToDelete(null); }} title="Eliminar proveedor" description={`Se eliminará al proveedor "${model.supplierToDelete?.name ?? ""}".`} isPending={model.deleteMutation.isPending} onConfirm={() => { if (model.supplierToDelete) model.deleteMutation.mutate(model.supplierToDelete.id); }} />
  </PageContainer></div></>;
}

export default function SuppliersPage() {
  const { currentCompany } = useAuth();
  return <AppLayout><SuppliersWorkspace key={currentCompany?.id ?? "no-company"} companyId={currentCompany?.id} /></AppLayout>;
}
