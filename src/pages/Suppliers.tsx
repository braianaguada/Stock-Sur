import { Suspense, lazy, useEffect, useState } from "react";
import { Plus, Search, Scale } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const SupplierDropDetailDialog = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierDropDetailDialog");
  return { default: module.SupplierDropDetailDialog };
});

const SupplierExtractionReviewDialog = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierExtractionReviewDialog");
  return { default: module.SupplierExtractionReviewDialog };
});

const SupplierComparison = lazy(async () => {
  const module = await import("@/features/suppliers/components/SupplierComparison");
  return { default: module.SupplierComparison };
});

const ColumnMappingModal = lazy(async () => {
  const module = await import("@/features/suppliers/components/ColumnMappingModal");
  return { default: module.ColumnMappingModal };
});

const PdfMappingModal = lazy(async () => {
  const module = await import("@/features/suppliers/components/PdfMappingModal");
  return { default: module.PdfMappingModal };
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
    extractionImportPending,
    extractionReviewLines,
    extractionReviewOpen,
    form,
    goToPurchaseOrder,
    goToPurchaseOrders,
    isCatalogLoading,
    isHistoryLoading,
    isLoading,
    isReorderSuggestionsLoading,
    lastDiagnostics,
    lineQuantities,
    mappingModalColumns,
    mappingModalConfidence,
    mappingModalOpen,
    mappingModalPreviewRows,
    mappingModalSuggested,
    onCatalogDialogOpenChange,
    onCatalogVersionSelect,
    onCopyOrderMessage,
    onConfirmExtractionImport,
    onExtractionReviewLineChange,
    onOpenEmail,
    onOpenWhatsApp,
    onRemoveExtractionReviewLine,
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
    pdfMappingHeaders,
    pdfMappingOpen,
    pdfMappingRows,
    pdfMappingSuggested,
    pdfProgress,
    saveMutation,
    search,
    selectedCatalogId,
    selectedFile,
    selectedSupplier,
    setCatalogSearch,
    setCatalogUiTab,
    setDialogOpen,
    setDocumentNotes,
    setDocumentTitle,
    setDropDetailOpen,
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
    setExtractionReviewLines,
    setExtractionReviewOpen,
  } = useSuppliersPage({
    companyId: currentCompany?.id,
    toast,
  });
  const pagination = usePaginationSlice({ items: suppliers, page, pageSize });

  useEffect(() => setPage(1), [search, statusFilter, currentCompany?.id]);

  return (
    <AppLayout>
      <PageContainer className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para trabajar con proveedores, catalogos e importaciones." />
        ) : null}

        <PageHeader
          eyebrow="Compras y catalogos"
          title="Proveedores"
          description="Administrá proveedores, consultá sus catálogos y prepará órdenes de compra."
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
            documentTitle={documentTitle}
            onDocumentTitleChange={setDocumentTitle}
            documentNotes={documentNotes}
            onDocumentNotesChange={setDocumentNotes}
            selectedCatalogId={selectedCatalogId}
            onSelectedCatalogIdChange={setSelectedCatalogId}
            selectedFile={selectedFile}
            onSelectedFileChange={setSelectedFile}
            onUpload={() => uploadCatalogMutation.mutate()}
            isUploading={uploadCatalogMutation.isPending}
            pdfProgress={pdfProgress}
            lastDiagnostics={lastDiagnostics}
            onOpenDropDetail={() => setDropDetailOpen(true)}
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

      {extractionReviewOpen ? (
        <Suspense fallback={<SupplierDialogLoader />}>
          <SupplierExtractionReviewDialog
            open={extractionReviewOpen}
            onOpenChange={setExtractionReviewOpen}
            fileName={selectedFile?.name ?? null}
            file={selectedFile}
            lines={extractionReviewLines}
            diagnostics={lastDiagnostics}
            isImporting={extractionImportPending}
            onLineChange={onExtractionReviewLineChange}
            onRemoveLine={onRemoveExtractionReviewLine}
            onConfirm={onConfirmExtractionImport}
            onCancel={() => {
              setExtractionReviewLines([]);
              setExtractionReviewOpen(false);
            }}
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

      {mappingModalOpen ? (
        <Suspense fallback={<SupplierDialogLoader />}>
          <ColumnMappingModal
            open={mappingModalOpen}
            onOpenChange={(open) => {
              if (!open) closeMappingModal();
              else setMappingModalOpen(true);
            }}
            columns={mappingModalColumns}
            previewRows={mappingModalPreviewRows}
            suggestedMapping={mappingModalSuggested}
            confidence={mappingModalConfidence}
            onConfirm={confirmMappingModal}
            onCancel={closeMappingModal}
          />
        </Suspense>
      ) : null}

      {pdfMappingOpen ? (
        <Suspense fallback={<SupplierDialogLoader />}>
          <PdfMappingModal
            open={pdfMappingOpen}
            onOpenChange={(open) => {
              if (!open) closePdfMappingModal();
              else setPdfMappingOpen(true);
            }}
            headers={pdfMappingHeaders}
            rows={pdfMappingRows}
            suggested={pdfMappingSuggested}
            onApply={confirmPdfMappingModal}
            onCancel={closePdfMappingModal}
          />
        </Suspense>
      ) : null}

      {dropDetailOpen ? (
        <Suspense fallback={<SupplierDialogLoader />}>
          <SupplierDropDetailDialog
            open={dropDetailOpen}
            onOpenChange={setDropDetailOpen}
            diagnostics={lastDiagnostics}
          />
        </Suspense>
      ) : null}

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto sm:h-[calc(100dvh-2rem)]">
          <DialogHeader>
            <DialogTitle>Comparación de proveedores</DialogTitle>
            <DialogDescription>Elegí listas, compará ofertas equivalentes y conservá siempre la moneda original.</DialogDescription>
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
