import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { parseImportFile } from "@/lib/importParser";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import {
  DEFAULT_PDF_OPTIONS,
  detectColumnsHeuristic,
  normalizeRowsToLines,
  parseFlexibleNumber,
  parsePdfToLines,
  parseXlsxToRows,
} from "@/lib/importers/catalogImporter";
import {
  ColumnMappingModal,
  type MappingColumnOption,
  type MappingPreviewRow,
  type MappingSelection,
} from "@/features/suppliers/components/ColumnMappingModal";
import { PdfMappingModal, type PdfMappingSelection } from "@/features/suppliers/components/PdfMappingModal";
import { SupplierCatalogDialog } from "@/features/suppliers/components/SupplierCatalogDialog";
import { SupplierFormDialog } from "@/features/suppliers/components/SupplierFormDialog";
import { SuppliersTable } from "@/features/suppliers/components/SuppliersTable";
import { deleteSupplier, restoreSupplier, saveSupplier } from "@/features/suppliers/mutations";
import {
  LOW_CONFIDENCE_THRESHOLD,
  SHOULD_LOG_SUPPLIER_IMPORT,
} from "@/features/suppliers/constants";
import {
  loadStoredSupplierImportMapping,
  saveStoredSupplierImportMapping,
  toSupplierCatalogRpcLinePayload,
} from "@/features/suppliers/importPersistence";
import { logSupplierImportError } from "@/features/suppliers/logging";
import {
  fetchSupplierCatalogLines,
  fetchSupplierCatalogVersions,
  fetchSupplierCatalogs,
  fetchSuppliers,
} from "@/features/suppliers/queries";
import {
  type CatalogImportLine,
  type CatalogLine,
  type ImportMappingStored,
  type NormalizeDiagnostics,
  type OrderLine,
  type ParsePdfProgress,
  type ParsedSheetData,
  type PdfImportMappingStored,
  type Supplier,
  type SupplierCatalog,
  type SupplierCatalogLinePayload,
  type SupplierCatalogVersion,
  type SupplierFormState,
} from "@/features/suppliers/types";
import { formatSupplierDate } from "@/features/suppliers/utils";
import { getErrorMessage } from "@/lib/errors";
import {
  addCatalogLineToOrder,
  buildSupplierFormState,
  buildSupplierOrderMessage,
  createCatalogDialogState,
  createEmptySupplierForm,
  groupSupplierVersionsByCatalog,
  normalizeSupplierQuantityInput,
  removeOrderItemFromState,
  updateOrderItemQuantity,
} from "@/features/suppliers/state";

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

  const requestXlsxMapping = (params: {
    headers: string[];
    previewRows: string[][];
    suggested: Omit<MappingSelection, "remember">;
    confidence: number;
  }) => new Promise<MappingSelection | null>((resolve) => {
    setMappingModalColumns(params.headers.map((header) => ({ key: header, label: header })));
    setMappingModalPreviewRows(
      params.previewRows.slice(0, 30).map((row, index) => ({
        id: `row-${index}`,
        values: row,
      })),
    );
    setMappingModalSuggested(params.suggested);
    setMappingModalConfidence(params.confidence);
    xlsxMappingResolverRef.current = resolve;
    setMappingModalOpen(true);
  });

  const closeMappingModal = () => {
    setMappingModalOpen(false);
    xlsxMappingResolverRef.current?.(null);
    xlsxMappingResolverRef.current = null;
  };

  const confirmMappingModal = (selection: MappingSelection) => {
    setMappingModalOpen(false);
    xlsxMappingResolverRef.current?.(selection);
    xlsxMappingResolverRef.current = null;
  };

  const requestPdfMapping = (params: {
    headers: string[];
    rows: string[][];
    suggested: Omit<PdfMappingSelection, "remember">;
  }) => new Promise<PdfMappingSelection | null>((resolve) => {
    setPdfMappingHeaders(params.headers);
    setPdfMappingRows(params.rows.slice(0, 60));
    setPdfMappingSuggested(params.suggested);
    pdfMappingResolverRef.current = resolve;
    setPdfMappingOpen(true);
  });

  const closePdfMappingModal = () => {
    setPdfMappingOpen(false);
    pdfMappingResolverRef.current?.(null);
    pdfMappingResolverRef.current = null;
  };

  const confirmPdfMappingModal = (selection: PdfMappingSelection) => {
    setPdfMappingOpen(false);
    pdfMappingResolverRef.current?.(selection);
    pdfMappingResolverRef.current = null;
  };

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", currentCompany?.id ?? "no-company", trimmedDeferredSearch, statusFilter],
    enabled: Boolean(currentCompany),
    queryFn: () => fetchSuppliers({
      companyId: currentCompany!.id,
      statusFilter,
      search: trimmedDeferredSearch,
    }),
  });

  const { data: catalogs = [] } = useQuery({
    queryKey: ["supplier-catalogs", currentCompany?.id ?? "no-company", selectedSupplier?.id],
    enabled: !!selectedSupplier && Boolean(currentCompany),
    queryFn: () => fetchSupplierCatalogs(currentCompany!.id, selectedSupplier!.id),
  });

  const { data: catalogVersions = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["supplier-catalog-versions", currentCompany?.id ?? "no-company", selectedSupplier?.id],
    enabled: !!selectedSupplier && Boolean(currentCompany),
    queryFn: () => fetchSupplierCatalogVersions(currentCompany!.id, selectedSupplier!.id),
  });

      const { data: activeCatalogLines = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ["supplier-catalog-lines", currentCompany?.id ?? "no-company", activeVersionId, trimmedDeferredCatalogSearch],
    enabled: !!activeVersionId && Boolean(currentCompany),
    queryFn: () => fetchSupplierCatalogLines({
      companyId: currentCompany!.id,
      versionId: activeVersionId!,
      search: trimmedDeferredCatalogSearch,
    }),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveSupplier({ companyId: currentCompany!.id, form, editingId: editing?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      toast({ title: editing ? "Proveedor actualizado" : "Proveedor creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(currentCompany!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor desactivado" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreSupplier(currentCompany!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor reactivado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadCatalogMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para importar catálogos");
      if (!selectedSupplier) throw new Error("Seleccioná un proveedor");
      if (!selectedFile) throw new Error("Seleccioná un archivo");

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      const extension = selectedFile.name.split(".").pop()?.toLowerCase();
      const isXlsx = ["xlsx", "xls"].includes(extension ?? "");
      const isPdf = extension === "pdf";
      const isText = ["csv", "txt", "tsv"].includes(extension ?? "");
      const fileType = isPdf ? "pdf" : isXlsx ? "xlsx" : isText ? "csv" : null;
      if (!fileType) throw new Error("Formato no soportado");

      const title = documentTitle.trim() || selectedFile.name;
      const requestedCatalogId = selectedCatalogId === "new" ? null : selectedCatalogId;
      if (requestedCatalogId && !catalogsById.has(requestedCatalogId)) {
        throw new Error("El listado seleccionado ya no está disponible. Recargá el historial e intentá de nuevo");
      }

      if (SHOULD_LOG_SUPPLIER_IMPORT) {
        console.log("[supplier-import] start", {
          userId,
          supplierId: selectedSupplier.id,
          requestedCatalogId,
          fileName: selectedFile.name,
          fileType,
        });
      }

      const { data: document, error: docError } = await supabase
        .from("supplier_documents")
        .insert({
          company_id: currentCompany.id,
          supplier_id: selectedSupplier.id,
          title,
          file_name: selectedFile.name,
          file_type: fileType,
          notes: documentNotes.trim() || null,
        })
        .select("id")
        .single();
      if (docError) {
        logSupplierImportError("insert_document", docError, { userId, requestedCatalogId });
        throw docError;
      }

      const supplierDocumentId = document.id;
      if (SHOULD_LOG_SUPPLIER_IMPORT) {
        console.log("[supplier-import] document_created", {
          userId,
          requestedCatalogId,
          supplierDocumentId,
        });
      }

      let lines: SupplierCatalogLinePayload[] = [];
      let diagnostics: NormalizeDiagnostics | null = null;

      if (isXlsx || isText) {
        let parsedSheet: ParsedSheetData;
        if (isXlsx) {
          parsedSheet = await parseXlsxToRows(selectedFile);
        } else {
          const parsed = await parseImportFile(selectedFile);
          const rows = parsed.rows.map((row) => parsed.headers.map((header) => String(row[header] ?? "")));
          parsedSheet = {
            sheetName: "text",
            headers: parsed.headers,
            rows,
            previewRows: rows.slice(0, 20),
            hasHeaderRow: true,
            detectedBlocks: 1,
          };
        }

        const detected = detectColumnsHeuristic(parsedSheet.headers, parsedSheet.rows);
        const stored = await loadStoredSupplierImportMapping<ImportMappingStored>(
          currentCompany.id,
          selectedSupplier.id,
          "xlsx",
        );
        const suggested = {
          descriptionColumn: stored?.descriptionColumn ?? detected.descriptionColumn,
          priceColumn: stored?.priceColumn ?? detected.priceColumn,
          currencyColumn: stored?.currencyColumn ?? detected.currencyColumn,
          supplierCodeColumn: stored?.supplierCodeColumn ?? detected.supplierCodeColumn,
        };

        let normalized = normalizeRowsToLines({
          headers: parsedSheet.headers,
          rows: parsedSheet.rows,
          mapping: suggested,
        });
        diagnostics = normalized.diagnostics;
        const missingDescRatio = diagnostics.totalRows > 0 ? diagnostics.dropped_missingDesc / diagnostics.totalRows : 0;
        const needsManualMapping = detected.confidence < LOW_CONFIDENCE_THRESHOLD || diagnostics.keptRows < 10 || missingDescRatio > 0.5;

        if (SHOULD_LOG_SUPPLIER_IMPORT) {
          console.log("[supplier-import] xlsx_detected", {
            userId,
            requestedCatalogId,
            supplierDocumentId,
            confidence: detected.confidence,
            suggested,
            diagnostics,
          });
        }

        if (needsManualMapping) {
          const mapping = await requestXlsxMapping({
            headers: parsedSheet.headers,
            previewRows: parsedSheet.previewRows,
            suggested,
            confidence: detected.confidence,
          });
          if (!mapping) throw new Error("Importacion cancelada por el usuario");
          normalized = normalizeRowsToLines({
            headers: parsedSheet.headers,
            rows: parsedSheet.rows,
            mapping,
          });
          diagnostics = normalized.diagnostics;
          if (mapping.remember) {
            try {
              await saveStoredSupplierImportMapping(currentCompany.id, selectedSupplier.id, "xlsx", {
                descriptionColumn: mapping.descriptionColumn,
                priceColumn: mapping.priceColumn,
                currencyColumn: mapping.currencyColumn,
                supplierCodeColumn: mapping.supplierCodeColumn,
              } satisfies ImportMappingStored);
            } catch (error) {
              logSupplierImportError("save_mapping", error, { supplierId: selectedSupplier.id, fileType: "xlsx" });
            }
          }
        }

        lines = normalized.lines.map(toSupplierCatalogRpcLinePayload);
      } else if (isPdf) {
        const parseResult = await parsePdfToLines(
          selectedFile,
          DEFAULT_PDF_OPTIONS,
          (progress) => setPdfProgress(progress),
        );

        const tableHeaders = parseResult.table?.headers ?? [];
        const tableRows = parseResult.table?.rows ?? [];
        if (tableHeaders.length === 0 || tableRows.length === 0) {
          if (parseResult.lines.length === 0) throw new Error("No se pudo extraer contenido del PDF");
          lines = parseResult.lines.map(toSupplierCatalogRpcLinePayload);
        } else {
          const stored = await loadStoredSupplierImportMapping<PdfImportMappingStored>(
            currentCompany.id,
            selectedSupplier.id,
            "pdf",
          );
          const suggested: Omit<PdfMappingSelection, "remember"> = {
            descriptionColumn: stored?.descriptionColumn ?? tableHeaders[0] ?? "col_1",
            priceColumn: stored?.priceColumn ?? tableHeaders[Math.min(1, tableHeaders.length - 1)] ?? "col_1",
            codeColumn: stored?.codeColumn ?? null,
            preferPriceAtEnd: stored?.preferPriceAtEnd ?? true,
            filterRowsWithoutPrice: stored?.filterRowsWithoutPrice ?? true,
          };

          const selection = await requestPdfMapping({
            headers: tableHeaders,
            rows: tableRows,
            suggested,
          });
          if (!selection) throw new Error("Importacion PDF cancelada por el usuario");
          const indexByHeader = new Map(tableHeaders.map((header, index) => [header, index]));
          const descIndex = indexByHeader.get(selection.descriptionColumn);
          const priceIndex = indexByHeader.get(selection.priceColumn);
          const codeIndex = selection.codeColumn ? indexByHeader.get(selection.codeColumn) : undefined;
          if (descIndex === undefined || priceIndex === undefined) throw new Error("Mapeo PDF invalido");

          const parsedLines: SupplierCatalogLinePayload[] = [];
          tableRows.forEach((row, idx) => {
            const rawDescription = String(row[descIndex] ?? "").replace(/\s+/g, " ").trim();
            const priceRaw = String(row[priceIndex] ?? "").trim();
            const parsed = parseFlexibleNumber(priceRaw);
            if (!rawDescription) return;
            if (selection.filterRowsWithoutPrice && parsed === null) return;
            if (parsed === null || parsed <= 0) return;
            const supplierCode = codeIndex !== undefined ? String(row[codeIndex] ?? "").trim() : "";
            parsedLines.push({
              supplier_code: supplierCode || null,
              raw_description: rawDescription,
              normalized_description: rawDescription.toLowerCase(),
              cost: parsed,
              currency: /usd|u\$s/i.test(priceRaw) ? "USD" : "ARS",
              row_index: idx + 1,
              matched_item_id: null,
              match_status: "PENDING",
            });
          });
          lines = parsedLines;
          if (selection.remember) {
            try {
              await saveStoredSupplierImportMapping(currentCompany.id, selectedSupplier.id, "pdf", {
                descriptionColumn: selection.descriptionColumn,
                priceColumn: selection.priceColumn,
                codeColumn: selection.codeColumn,
                preferPriceAtEnd: selection.preferPriceAtEnd,
                filterRowsWithoutPrice: selection.filterRowsWithoutPrice,
              } satisfies PdfImportMappingStored);
            } catch (error) {
              logSupplierImportError("save_mapping", error, { supplierId: selectedSupplier.id, fileType: "pdf" });
            }
          }
        }
      }

      setPdfProgress(null);
      setLastDiagnostics(diagnostics);
      if (lines.length === 0) throw new Error("No se encontraron filas validas para importar");

      const { data: rpcResult, error: rpcError } = await supabase.rpc("create_supplier_catalog_import", {
        p_supplier_id: selectedSupplier.id,
        p_supplier_document_id: supplierDocumentId,
        p_catalog_id: requestedCatalogId,
        p_catalog_title: requestedCatalogId ? null : title,
        p_catalog_notes: documentNotes.trim() || null,
        p_version_title: title,
        p_lines: lines,
      });
      if (rpcError) {
        logSupplierImportError("create_supplier_catalog_import", rpcError, {
          userId,
          requestedCatalogId,
          supplierDocumentId,
          lineCount: lines.length,
        });
        throw rpcError;
      }

      const response = (rpcResult ?? {}) as { version_id?: string; inserted_count?: number };
      if (SHOULD_LOG_SUPPLIER_IMPORT) {
        console.log("[supplier-import] rpc_done", {
          userId,
          requestedCatalogId,
          supplierDocumentId,
          insertedCount: response.inserted_count ?? lines.length,
          versionId: response.version_id,
        });
      }

      return {
        total: response.inserted_count ?? lines.length,
        parsed: true,
        versionId: response.version_id ?? null,
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["supplier-catalogs", selectedSupplier?.id] });
      qc.invalidateQueries({ queryKey: ["supplier-catalog-versions", selectedSupplier?.id] });
      qc.invalidateQueries({ queryKey: ["supplier-catalog-lines"] });
      setDocumentTitle("");
      setDocumentNotes("");
      setSelectedCatalogId("new");
      setSelectedFile(null);
      setPdfProgress(null);
      if (result.versionId) setActiveVersionId(result.versionId);
      setCatalogUiTab("catalogo");
      setOrderItems({});
      setLineQuantities({});
      toast({
        title: "Documento cargado",
        description: `Importados ${result.total} items`,
      });
    },
    onError: (error: unknown) => {
      setPdfProgress(null);
      setSelectedFile(null);
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    },
  });

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
  const activeVersion = useMemo(
    () => (activeVersionId ? catalogVersionsById.get(activeVersionId) ?? null : null),
    [catalogVersionsById, activeVersionId],
  );

  const catalogTitleById = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog.title])),
    [catalogs],
  );

  const versionsByCatalog = useMemo(() => groupSupplierVersionsByCatalog(catalogVersions), [catalogVersions]);

  const orderLines = useMemo(() => Object.values(orderItems), [orderItems]);
  const orderTotal = useMemo(
    () => orderLines.reduce((acc, line) => acc + (line.cost * line.quantity), 0),
    [orderLines],
  );

  const orderMessage = useMemo(() =>
    buildSupplierOrderMessage({
      selectedSupplier,
      orderLines,
      activeVersion,
      catalogTitleById,
    }),
  [selectedSupplier, activeVersion, catalogTitleById, orderLines]);


  const waLink = useMemo(
    () => buildWhatsAppLink(selectedSupplier?.whatsapp, orderMessage),
    [selectedSupplier?.whatsapp, orderMessage],
  );

  const addToOrder = (line: CatalogLine) => {
    setOrderItems((prev) => addCatalogLineToOrder(prev, lineQuantities, line));
  };

  const updateLineQuantity = (lineId: string, value: string) => {
    const quantity = normalizeSupplierQuantityInput(value);
    if (quantity === null) return;
    setLineQuantities((prev) => ({ ...prev, [lineId]: quantity }));
  };

  const updateOrderQuantity = (lineId: string, value: string) => {
    const quantity = normalizeSupplierQuantityInput(value);
    if (quantity === null) return;
    setOrderItems((prev) => updateOrderItemQuantity(prev, lineId, quantity));
  };

  const removeOrderItem = (lineId: string) => {
    setOrderItems((prev) => removeOrderItemFromState(prev, lineId));
  };

  const copyOrderMessage = async () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacío", description: "Agregá al menos un producto", variant: "destructive" });
      return;
    }

    await navigator.clipboard.writeText(orderMessage);
    toast({ title: "Mensaje copiado" });
  };

  const openWhatsApp = () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacío", description: "Agregá al menos un producto", variant: "destructive" });
      return;
    }

    if (!waLink) {
      toast({ title: "Proveedor sin WhatsApp", description: "Completá el número para abrir WhatsApp", variant: "destructive" });
      return;
    }

    window.open(waLink, "_blank", "noopener,noreferrer");
  };

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

      <Dialog open={dropDetailOpen} onOpenChange={setDropDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Filas descartadas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastDiagnostics?.sampleDropped?.length ? (
                  lastDiagnostics.sampleDropped.map((row) => (
                    <TableRow key={`${row.rowIndex}-${row.reason}`}>
                      <TableCell>{row.rowIndex}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell className="font-mono text-xs">{row.rowPreview.join(" | ")}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                      Sin muestra disponible
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}



