import { Suspense, lazy, useEffect, useState } from "react";
import { Plus, Search, Scale } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SuppliersTable } from "@/features/suppliers/components/SuppliersTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { useSuppliersPage } from "@/features/suppliers/hooks/useSuppliersPage";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import type { SupplierComparisonOffer } from "@/features/suppliers/comparison/domain";

const SupplierFormDialog = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierFormDialog");
  return { default: module.SupplierFormDialog };
});

const SupplierCatalogDialog = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierCatalogDialog");
  return { default: module.SupplierCatalogDialog };
});

const SupplierComparison = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierComparison");
  return { default: module.SupplierComparison };
});

const SupplierExcelImport = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierExcelImport");
  return { default: module.SupplierExcelImport };
});

function SupplierDialogLoader() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      Cargando proveedor...
    </div>
  );
}

export default function SuppliersPage() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [comparisonSelection, setComparisonSelection] = useState<SupplierComparisonOffer[]>([]);
  useEffect(() => {
    setComparisonSelection([]);
  }, [currentCompany?.id]);
  const {
    activeCatalogLines,
    activeVersion,
    activeVersionId,
    addToOrder,
    addSuggestionsToOrder,
    catalogDialogOpen,
    catalogSearch,
    catalogTitleById,
    catalogUiTab,
    catalogs,
    importOpen,
    startImport,
    cancelImport,
    finishImport,
    deleteMutation,
    dialogOpen,
    editing,
    form,
    goToPurchaseOrder,
    goToPurchaseOrders,
    isCatalogLoading,
    isHistoryLoading,
    isLoading,
    isReorderSuggestionsLoading,
    lineQuantities,
    onCatalogDialogOpenChange,
    onCatalogVersionSelect,
    onCopyOrderMessage,
    onOpenEmail,
    onOpenWhatsApp,
    onRemoveOrderItem,
    onRestoreSupplier,
    onUpdateLineQuantity,
    onUpdateOrderQuantity,
    openCatalog,
    openCreate,
    openEdit,
    orderLines,
    orderTotalsByCurrency,
    purchaseOrders,
    reorderSuggestions,
    isPurchaseOrdersLoading,
    isCreatingPurchaseOrder,
    lastPurchaseOrder,
    onCreatePurchaseOrder,
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
  } = useSuppliersPage({
    companyId: currentCompany?.id,
    toast,
  });
  const pagination = usePaginationSlice({ items: suppliers, page, pageSize });

  useEffect(() => setPage(1), [search, statusFilter, currentCompany?.id]);

  if (importOpen && selectedSupplier && currentCompany) {
    return <AppLayout><Suspense fallback={<SupplierDialogLoader />}>
      <SupplierExcelImport key={currentCompany.id + selectedSupplier.id} companyId={currentCompany.id} supplier={selectedSupplier} catalogs={catalogs} onCancel={cancelImport} onImported={finishImport} />
    </Suspense></AppLayout>;
  }

  return (
    <AppLayout>
      <PageContainer className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para trabajar con proveedores, catalogos e importaciones." />
        ) : null}

        <PageHeader
          eyebrow="Compras y catalogos"
          title="Proveedores"
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setComparisonOpen(true)} disabled={!currentCompany}>
                <Scale className="mr-2 h-4 w-4" /> Comparar listas
              </Button>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo proveedor</Button>
            </div>
          )}
        />

        <FilterToolbar>
          <div className="relative w-full md:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar proveedores" placeholder="Buscar por nombre, contacto o email" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full md:w-56">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "active" | "inactive" | "all")}>
              <SelectTrigger aria-label="Filtrar proveedores por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterToolbar>

        <SuppliersTable
          suppliers={pagination.pagedItems}
          isLoading={isLoading}
          onOpenCatalog={openCatalog}
          onOpenEdit={openEdit}
          onDelete={setSupplierToDelete}
          onRestore={onRestoreSupplier}
        />
        <DataTablePagination
          {...pagination}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
          itemLabel="proveedores"
        />
      </PageContainer>

      {dialogOpen ? (
        <Suspense fallback={<SupplierDialogLoader />}>
          <SupplierFormDialog
            open={dialogOpen}
            editingName={editing?.name}
            form={form}
            showAdvanced={showAdvanced}
            isSaving={saveMutation.isPending}
            onOpenChange={setDialogOpen}
            onShowAdvancedChange={setShowAdvanced}
            onFormChange={setForm}
            onSubmit={() => saveMutation.mutate()}
          />
        </Suspense>
      ) : null}

      {catalogDialogOpen ? (
        <Suspense fallback={<SupplierDialogLoader />}>
          <SupplierCatalogDialog
            open={catalogDialogOpen}
            onOpenChange={onCatalogDialogOpenChange}
            selectedSupplier={selectedSupplier}
            catalogUiTab={catalogUiTab}
            onCatalogUiTabChange={setCatalogUiTab}
            onStartImport={startImport}
            catalogs={catalogs}
            isHistoryLoading={isHistoryLoading}
            versionsByCatalog={versionsByCatalog}
            activeVersionId={activeVersionId}
            onSelectVersion={onCatalogVersionSelect}
            activeVersion={activeVersion}
            catalogTitleById={catalogTitleById}
            catalogSearch={catalogSearch}
            onCatalogSearchChange={setCatalogSearch}
            isCatalogLoading={isCatalogLoading}
            activeCatalogLines={activeCatalogLines}
            lineQuantities={lineQuantities}
            onLineQuantityChange={onUpdateLineQuantity}
            onAddToOrder={addToOrder}
            reorderSuggestions={reorderSuggestions}
            isReorderSuggestionsLoading={isReorderSuggestionsLoading}
            onAddReorderSuggestions={addSuggestionsToOrder}
            onViewPurchaseOrder={goToPurchaseOrder}
            onGoToPurchaseOrders={goToPurchaseOrders}
            orderLines={orderLines}
            orderTotalsByCurrency={orderTotalsByCurrency}
            onOrderQuantityChange={onUpdateOrderQuantity}
            onRemoveOrderItem={onRemoveOrderItem}
            onCopyOrderMessage={onCopyOrderMessage}
            onOpenEmail={onOpenEmail}
            onOpenWhatsApp={onOpenWhatsApp}
            purchaseOrders={purchaseOrders}
            isPurchaseOrdersLoading={isPurchaseOrdersLoading}
            isCreatingPurchaseOrder={isCreatingPurchaseOrder}
            lastPurchaseOrder={lastPurchaseOrder}
            onCreatePurchaseOrder={onCreatePurchaseOrder}
          />
        </Suspense>
      ) : null}

      <ConfirmDeleteDialog
        open={!!supplierToDelete}
        onOpenChange={(open) => {
          if (!open) setSupplierToDelete(null);
        }}
        title="Eliminar proveedor"
        description={
          supplierToDelete
            ? `Esta accion eliminara al proveedor "${supplierToDelete.name}" de forma permanente.`
            : ""
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!supplierToDelete) return;
          deleteMutation.mutate(supplierToDelete.id);
          setSupplierToDelete(null);
        }}
      />

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent aria-describedby={undefined} className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto sm:h-[calc(100dvh-2rem)]">
          <DialogHeader>
            <DialogTitle>Comparación de proveedores</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<SupplierDialogLoader />}>
            <SupplierComparison
              companyId={currentCompany?.id ?? null}
              selectedOffers={comparisonSelection}
              onRemoveOffer={(offerId) => setComparisonSelection((current) => current.filter((offer) => offer.id !== offerId))}
              onClearSelection={() => setComparisonSelection([])}
              onSelectOffer={(offer) => {
                setComparisonSelection((current) => current.some((selected) => selected.id === offer.id) ? current : [...current, offer]);
                toast({ title: `${offer.description} seleccionado`, description: `${offer.supplierName} · ${offer.currency} ${offer.cost.toLocaleString("es-AR")}` });
              }}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
