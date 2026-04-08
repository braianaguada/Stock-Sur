import { Suspense, lazy } from "react";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SuppliersTable } from "@/features/suppliers/components/SuppliersTable";
import { useSuppliersPage } from "@/features/suppliers/hooks/useSuppliersPage";

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
  const {
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
    isCatalogLoading,
    isHistoryLoading,
    isLoading,
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
    onOpenWhatsApp,
    onRemoveOrderItem,
    onRestoreSupplier,
    onUpdateLineQuantity,
    onUpdateOrderQuantity,
    openCatalog,
    openCreate,
    openEdit,
    orderLines,
    orderTotal,
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
  } = useSuppliersPage({
    companyId: currentCompany?.id,
    toast,
  });

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para trabajar con proveedores, catalogos e importaciones." />
        ) : null}

        <PageHeader
          eyebrow="Compras y catalogos"
          title="Proveedores"
          description="Gestion de proveedores, versiones de catalogos e importaciones. Se mejora jerarquia visual sin tocar el flujo de carga ni el matching."
          actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo proveedor</Button>}
        />

        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full md:w-56">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "active" | "inactive" | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <SuppliersTable
          suppliers={suppliers}
          isLoading={isLoading}
          onOpenCatalog={openCatalog}
          onOpenEdit={openEdit}
          onDelete={setSupplierToDelete}
          onRestore={onRestoreSupplier}
        />
      </div>

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
            orderLines={orderLines}
            orderTotal={orderTotal}
            onOrderQuantityChange={onUpdateOrderQuantity}
            onRemoveOrderItem={onRemoveOrderItem}
            onCopyOrderMessage={onCopyOrderMessage}
            onOpenWhatsApp={onOpenWhatsApp}
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
    </AppLayout>
  );
}
