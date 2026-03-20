import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, MessageCircle, Copy } from "lucide-react";
import {
  ColumnMappingModal,
  type MappingColumnOption,
  type MappingPreviewRow,
  type MappingSelection,
} from "@/features/suppliers/components/ColumnMappingModal";
import { PdfMappingModal, type PdfMappingSelection } from "@/features/suppliers/components/PdfMappingModal";
import { SupplierCatalogDialog } from "@/features/suppliers/components/SupplierCatalogDialog";
import { SupplierDropDetailDialog } from "@/features/suppliers/components/SupplierDropDetailDialog";
import { SupplierFormDialog } from "@/features/suppliers/components/SupplierFormDialog";
import { SuppliersTable } from "@/features/suppliers/components/SuppliersTable";
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
  type CatalogImportLine,
  type CatalogLine,
  type NormalizeDiagnostics,
  type OrderLine,
  type ParsePdfProgress,
  type Supplier,
  type SupplierCatalog,
  type SupplierCatalogVersion,
  type SupplierFormState,
} from "@/features/suppliers/types";
import { formatSupplierDate } from "@/features/suppliers/utils";
import {
  buildSupplierFormState,
  createCatalogDialogState,
  createEmptySupplierForm,
  groupSupplierVersionsByCatalog,
} from "@/features/suppliers/state";

const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_CATALOGS: SupplierCatalog[] = [];
const EMPTY_CATALOG_VERSIONS: SupplierCatalogVersion[] = [];
const EMPTY_CATALOG_LINES: CatalogImportLine[] = [];

export default function SuppliersPage() {
  const { currentCompany } = useAuth();
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
  const xlsxMappingResolverRef = useRef<((value: MappingSelection | null) => void) | null>(null);
  const pdfMappingResolverRef = useRef<((value: PdfMappingSelection | null) => void) | null>(null);
  const deferredSearch = useDeferredValue(search);
  const trimmedDeferredSearch = deferredSearch.trim();
  const deferredCatalogSearch = useDeferredValue(catalogSearch);
  const trimmedDeferredCatalogSearch = deferredCatalogSearch.trim();

  const { toast } = useToast();
  const qc = useQueryClient();

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", currentCompany?.id ?? "no-company", trimmedDeferredSearch, statusFilter],
    enabled: Boolean(currentCompany),
    queryFn: () => fetchSuppliers({
      companyId: currentCompany!.id,
      statusFilter,
      search: trimmedDeferredSearch,
    }),
  });
  const suppliers = suppliersQuery.data ?? EMPTY_SUPPLIERS;
  const isLoading = suppliersQuery.isLoading;

  const catalogsQuery = useQuery({
    queryKey: ["supplier-catalogs", currentCompany?.id ?? "no-company", selectedSupplier?.id],
    enabled: !!selectedSupplier && Boolean(currentCompany),
    queryFn: () => fetchSupplierCatalogs(currentCompany!.id, selectedSupplier!.id),
  });
  const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;

  const catalogVersionsQuery = useQuery({
    queryKey: ["supplier-catalog-versions", currentCompany?.id ?? "no-company", selectedSupplier?.id],
    enabled: !!selectedSupplier && Boolean(currentCompany),
    queryFn: () => fetchSupplierCatalogVersions(currentCompany!.id, selectedSupplier!.id),
  });
  const catalogVersions = catalogVersionsQuery.data ?? EMPTY_CATALOG_VERSIONS;
  const isHistoryLoading = catalogVersionsQuery.isLoading;

  const activeCatalogLinesQuery = useQuery({
    queryKey: ["supplier-catalog-lines", currentCompany?.id ?? "no-company", activeVersionId, trimmedDeferredCatalogSearch],
    enabled: !!activeVersionId && Boolean(currentCompany),
    queryFn: () => fetchSupplierCatalogLines({
      companyId: currentCompany!.id,
      versionId: activeVersionId!,
      search: trimmedDeferredCatalogSearch,
    }),
  });
  const activeCatalogLines = activeCatalogLinesQuery.data ?? EMPTY_CATALOG_LINES;
  const isCatalogLoading = activeCatalogLinesQuery.isLoading;

  const openCreate = () => {
    setEditing(null);
    setForm(createEmptySupplierForm());
    setShowAdvanced(false);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm(buildSupplierFormState(s));
    setDialogOpen(true);
  };

  const openCatalog = (supplier: Supplier) => {
    const nextState = createCatalogDialogState();
    setSelectedSupplier(supplier);
    setCatalogSearch(nextState.catalogSearch);
    setActiveVersionId(nextState.activeVersionId);
    setOrderItems(nextState.orderItems);
    setLineQuantities(nextState.lineQuantities);
    setLastDiagnostics(nextState.lastDiagnostics);
    setPdfProgress(nextState.pdfProgress);
    setSelectedCatalogId(nextState.selectedCatalogId);
    setSelectedFile(nextState.selectedFile);
    setCatalogUiTab(nextState.catalogUiTab);
    setCatalogDialogOpen(true);
  };

  const handleCatalogDialogOpenChange = (open: boolean) => {
    setCatalogDialogOpen(open);
    if (open) return;
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
  };

  const catalogVersionsById = useMemo(
    () => new Map(catalogVersions.map((version) => [version.id, version])),
    [catalogVersions],
  );
  const catalogsById = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog])),
    [catalogs],
  );
  const {
    closeMappingModal,
    closePdfMappingModal,
    confirmMappingModal,
    confirmPdfMappingModal,
    uploadCatalogMutation,
  } = useSupplierImportFlow({
    currentCompanyId: currentCompany?.id ?? null,
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
  const activeVersion = useMemo(
    () => (activeVersionId ? catalogVersionsById.get(activeVersionId) ?? null : null),
    [catalogVersionsById, activeVersionId],
  );

  const catalogTitleById = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog.title])),
    [catalogs],
  );

  const versionsByCatalog = useMemo(() => groupSupplierVersionsByCatalog(catalogVersions), [catalogVersions]);

  const {
    addToOrder,
    copyOrderMessage,
    openWhatsApp,
    orderLines,
    orderTotal,
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitás una empresa activa para trabajar con proveedores, catálogos e importaciones." />
        ) : null}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
            <p className="text-muted-foreground">Gestión de proveedores y catálogos</p>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo proveedor</Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
        </div>

        <SuppliersTable
          suppliers={suppliers}
          isLoading={isLoading}
          onOpenCatalog={openCatalog}
          onOpenEdit={openEdit}
          onDelete={setSupplierToDelete}
          onRestore={(supplierId) => restoreMutation.mutate(supplierId)}
        />
      </div>

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

      <SupplierCatalogDialog
        open={catalogDialogOpen}
        onOpenChange={handleCatalogDialogOpenChange}
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
        onSelectVersion={(versionId) => {
          setActiveVersionId(versionId);
          setCatalogSearch("");
          setOrderItems({});
          setLineQuantities({});
          setCatalogUiTab("catalogo");
        }}
        activeVersion={activeVersion}
        catalogTitleById={catalogTitleById}
        catalogSearch={catalogSearch}
        onCatalogSearchChange={setCatalogSearch}
        isCatalogLoading={isCatalogLoading}
        activeCatalogLines={activeCatalogLines}
        lineQuantities={lineQuantities}
        onLineQuantityChange={updateLineQuantity}
        onAddToOrder={addToOrder}
        orderLines={orderLines}
        orderTotal={orderTotal}
        onOrderQuantityChange={updateOrderQuantity}
        onRemoveOrderItem={removeOrderItem}
        onCopyOrderMessage={copyOrderMessage}
        onOpenWhatsApp={openWhatsApp}
      />
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

      <SupplierDropDetailDialog
        open={dropDetailOpen}
        onOpenChange={setDropDetailOpen}
        diagnostics={lastDiagnostics}
      />
    </AppLayout>
  );
}




