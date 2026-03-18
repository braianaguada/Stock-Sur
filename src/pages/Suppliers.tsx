import { useMemo, useRef, useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Pencil, Trash2, Upload, MessageCircle, Copy, ChevronDown, RotateCcw } from "lucide-react";
import { parseImportFile } from "@/lib/importParser";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { buildWhatsAppLink, normalizeWhatsappNumber } from "@/lib/whatsapp";
import {
  DEFAULT_PDF_OPTIONS,
  detectColumnsHeuristic,
  normalizeRowsToLines,
  parseFlexibleNumber,
  parsePdfToLines,
  parseXlsxToRows,
  type CatalogImportLine,
  type NormalizeDiagnostics,
  type ParsePdfProgress,
  type ParsedSheetData,
} from "@/lib/importers/catalogImporter";
import {
  ColumnMappingModal,
  type MappingColumnOption,
  type MappingPreviewRow,
  type MappingSelection,
} from "@/components/suppliers/ColumnMappingModal";
import { PdfMappingModal, type PdfMappingSelection } from "@/components/suppliers/PdfMappingModal";
import { getErrorMessage } from "@/lib/errors";

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  is_active: boolean;
}

interface SupplierCatalog {
  id: string;
  title: string;
  created_at: string;
}

interface SupplierCatalogVersion {
  id: string;
  catalog_id: string;
  title: string | null;
  imported_at: string;
  supplier_document_id: string;
  file_name: string;
  file_type: string;
  line_count: number;
}

interface CatalogLine {
  id: string;
  supplier_code: string | null;
  raw_description: string;
  cost: number;
  currency: string;
}

interface OrderLine extends CatalogLine {
  quantity: number;
}

interface SupplierCatalogLinePayload {
  supplier_code: string | null;
  raw_description: string;
  normalized_description: string | null;
  cost: number;
  currency: string;
  row_index: number;
  matched_item_id: string | null;
  match_status: "MATCHED" | "PENDING" | "NEW";
}

interface ImportMappingStored {
  descriptionColumn: string;
  priceColumn: string;
  currencyColumn?: string | null;
  supplierCodeColumn?: string | null;
}

interface PdfImportMappingStored {
  descriptionColumn: string;
  priceColumn: string;
  codeColumn?: string | null;
  preferPriceAtEnd?: boolean;
  filterRowsWithoutPrice?: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.24;
const LOCAL_MAPPING_PREFIX = "supplier-import-mapping";

function formatDate(date: string) {
  return new Date(date).toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [form, setForm] = useState({ name: "", contact_name: "", email: "", whatsapp: "", notes: "" });
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

  const { toast } = useToast();
  const qc = useQueryClient();

  const logSupabaseError = (scope: string, error: unknown, extra?: Record<string, unknown>) => {
    if (error && typeof error === "object") {
      const err = error as { code?: string; message?: string; details?: string; hint?: string };
      console.error("[supplier-import]", {
        scope,
        code: err.code,
        message: err.message,
        details: err.details,
        hint: err.hint,
        ...extra,
      });
      return;
    }
    console.error("[supplier-import]", { scope, error, ...extra });
  };

  const localMappingKey = (supplierId: string, fileType: "xlsx" | "pdf") =>
    `${LOCAL_MAPPING_PREFIX}:${supplierId}:${fileType}`;

  const loadStoredMapping = async <T,>(supplierId: string, fileType: "xlsx" | "pdf"): Promise<T | null> => {
    try {
      const { data, error } = await supabase
        .from("supplier_import_mappings")
        .select("mapping")
        .eq("company_id", currentCompany!.id)
        .eq("supplier_id", supplierId)
        .eq("file_type", fileType)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.mapping as T | undefined) ?? null;
    } catch (error) {
      const cached = localStorage.getItem(localMappingKey(supplierId, fileType));
      if (!cached) return null;
      try {
        return JSON.parse(cached) as T;
      } catch {
        return null;
      }
    }
  };

  const saveStoredMapping = async <T,>(supplierId: string, fileType: "xlsx" | "pdf", mapping: T) => {
    localStorage.setItem(localMappingKey(supplierId, fileType), JSON.stringify(mapping));
    try {
      const { error } = await supabase
        .from("supplier_import_mappings")
        .upsert(
            {
              company_id: currentCompany!.id,
              supplier_id: supplierId,
              file_type: fileType,
              mapping,
          },
          { onConflict: "supplier_id,file_type" },
        );
      if (error) throw error;
    } catch (error) {
      logSupabaseError("save_mapping", error, { supplierId, fileType });
    }
  };

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

  const toRpcLinePayload = (line: CatalogImportLine): SupplierCatalogLinePayload => ({
    supplier_code: line.supplier_code,
    raw_description: line.raw_description,
    normalized_description: line.normalized_description,
    cost: line.cost,
    currency: line.currency || "ARS",
    row_index: line.row_index,
    matched_item_id: null,
    match_status: "PENDING",
  });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", currentCompany?.id ?? "no-company", search, statusFilter],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      let q = supabase.from("suppliers").select("*").eq("company_id", currentCompany!.id).order("name");
      if (statusFilter === "active") q = q.eq("is_active", true);
      if (statusFilter === "inactive") q = q.eq("is_active", false);
      if (search) q = q.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: catalogs = [] } = useQuery({
    queryKey: ["supplier-catalogs", currentCompany?.id ?? "no-company", selectedSupplier?.id],
    enabled: !!selectedSupplier && Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalogs")
        .select("id, title, created_at")
        .eq("company_id", currentCompany!.id)
        .eq("supplier_id", selectedSupplier!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierCatalog[];
    },
  });

  const { data: catalogVersions = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["supplier-catalog-versions", currentCompany?.id ?? "no-company", selectedSupplier?.id],
    enabled: !!selectedSupplier && Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog_versions")
        .select("id, catalog_id, title, imported_at, supplier_document_id")
        .eq("company_id", currentCompany!.id)
        .eq("supplier_id", selectedSupplier!.id)
        .order("imported_at", { ascending: false });
      if (error) throw error;

      const versions = (data ?? []) as Array<{
        id: string;
        catalog_id: string;
        title: string | null;
        imported_at: string;
        supplier_document_id: string;
      }>;

      if (versions.length === 0) return [];

      const { data: docs, error: docsError } = await supabase
        .from("supplier_documents")
        .select("id, file_name, file_type")
        .eq("company_id", currentCompany!.id)
        .eq("supplier_id", selectedSupplier!.id);
      if (docsError) throw docsError;
      const docsById = new Map((docs ?? []).map((doc) => [doc.id, doc]));

      const { data: lineCounts, error: lineCountError } = await supabase
        .from("supplier_catalog_lines")
        .select("supplier_catalog_version_id")
        .in("supplier_catalog_version_id", versions.map((version) => version.id));
      if (lineCountError) throw lineCountError;

      const countMap = (lineCounts ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.supplier_catalog_version_id] = (acc[row.supplier_catalog_version_id] ?? 0) + 1;
        return acc;
      }, {});

      return versions.map((version) => {
        const doc = docsById.get(version.supplier_document_id);
        return {
          ...version,
          file_name: doc?.file_name ?? "archivo",
          file_type: doc?.file_type ?? "-",
          line_count: countMap[version.id] ?? 0,
        };
      }) as SupplierCatalogVersion[];
    },
  });

      const { data: activeCatalogLines = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ["supplier-catalog-lines", currentCompany?.id ?? "no-company", activeVersionId, catalogSearch],
    enabled: !!activeVersionId && Boolean(currentCompany),
    queryFn: async () => {
      let query = supabase
        .from("supplier_catalog_lines")
        .select("id, supplier_code, raw_description, cost, currency")
        .eq("company_id", currentCompany!.id)
        .eq("supplier_catalog_version_id", activeVersionId!)
        .order("row_index", { ascending: true, nullsFirst: false })
        .limit(250);

      if (catalogSearch.trim()) {
        const safe = catalogSearch.trim();
        query = query.or(`raw_description.ilike.%${safe}%,supplier_code.ilike.%${safe}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CatalogLine[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        contact_name: form.contact_name || null,
        email: form.email || null,
        whatsapp: form.whatsapp || null,
        phone: form.whatsapp || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("company_id", currentCompany!.id).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ company_id: currentCompany!.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      toast({ title: editing ? "Proveedor actualizado" : "Proveedor creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteByStrategy({ table: "suppliers", id, eq: { company_id: currentCompany!.id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor desactivado" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").update({ is_active: true }).eq("company_id", currentCompany!.id).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor reactivado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadCatalogMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Selecciona una empresa para importar catalogos");
      if (!selectedSupplier) throw new Error("Selecciona un proveedor");
      if (!selectedFile) throw new Error("Selecciona un archivo");

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

      console.log("[supplier-import] start", {
        userId,
        supplierId: selectedSupplier.id,
        requestedCatalogId,
        fileName: selectedFile.name,
        fileType,
      });

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
        logSupabaseError("insert_document", docError, { userId, requestedCatalogId });
        throw docError;
      }

      const supplierDocumentId = document.id;
      console.log("[supplier-import] document_created", {
        userId,
        requestedCatalogId,
        supplierDocumentId,
      });

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
        const stored = await loadStoredMapping<ImportMappingStored>(selectedSupplier.id, "xlsx");
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

        console.log("[supplier-import] xlsx_detected", {
          userId,
          requestedCatalogId,
          supplierDocumentId,
          confidence: detected.confidence,
          suggested,
          diagnostics,
        });

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
            await saveStoredMapping(selectedSupplier.id, "xlsx", {
              descriptionColumn: mapping.descriptionColumn,
              priceColumn: mapping.priceColumn,
              currencyColumn: mapping.currencyColumn,
              supplierCodeColumn: mapping.supplierCodeColumn,
            } satisfies ImportMappingStored);
          }
        }

        lines = normalized.lines.map(toRpcLinePayload);
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
          lines = parseResult.lines.map(toRpcLinePayload);
        } else {
          const stored = await loadStoredMapping<PdfImportMappingStored>(selectedSupplier.id, "pdf");
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
            await saveStoredMapping(selectedSupplier.id, "pdf", {
              descriptionColumn: selection.descriptionColumn,
              priceColumn: selection.priceColumn,
              codeColumn: selection.codeColumn,
              preferPriceAtEnd: selection.preferPriceAtEnd,
              filterRowsWithoutPrice: selection.filterRowsWithoutPrice,
            } satisfies PdfImportMappingStored);
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
        logSupabaseError("create_supplier_catalog_import", rpcError, {
          userId,
          requestedCatalogId,
          supplierDocumentId,
          lineCount: lines.length,
        });
        throw rpcError;
      }

      const response = (rpcResult ?? {}) as { version_id?: string; inserted_count?: number };
      console.log("[supplier-import] rpc_done", {
        userId,
        requestedCatalogId,
        supplierDocumentId,
        insertedCount: response.inserted_count ?? lines.length,
        versionId: response.version_id,
      });

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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["supplier-catalog-versions", selectedSupplier?.id] });
      qc.invalidateQueries({ queryKey: ["supplier-catalog-lines"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", contact_name: "", email: "", whatsapp: "", notes: "" });
    setShowAdvanced(false);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      contact_name: s.contact_name ?? "",
      email: s.email ?? "",
      whatsapp: s.whatsapp ?? s.phone ?? "",
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };

  const openCatalog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setCatalogSearch("");
    setActiveVersionId(null);
    setOrderItems({});
    setLineQuantities({});
    setLastDiagnostics(null);
    setPdfProgress(null);
    setSelectedCatalogId("new");
    setCatalogUiTab("catalogo");
    setCatalogDialogOpen(true);
  };

  const activeVersion = useMemo(
    () => catalogVersions.find((version) => version.id === activeVersionId) ?? null,
    [catalogVersions, activeVersionId],
  );

  const catalogTitleById = useMemo(() => {
    const map = new Map<string, string>();
    catalogs.forEach((catalog) => map.set(catalog.id, catalog.title));
    return map;
  }, [catalogs]);

  const versionsByCatalog = useMemo(() => {
    const grouped: Record<string, SupplierCatalogVersion[]> = {};
    catalogVersions.forEach((version) => {
      if (!grouped[version.catalog_id]) grouped[version.catalog_id] = [];
      grouped[version.catalog_id].push(version);
    });
    return grouped;
  }, [catalogVersions]);

  const orderLines = useMemo(() => Object.values(orderItems), [orderItems]);
  const orderTotal = useMemo(
    () => orderLines.reduce((acc, line) => acc + (line.cost * line.quantity), 0),
    [orderLines],
  );

  const orderMessage = useMemo(() => {
    if (!selectedSupplier || orderLines.length === 0) return "";
    const versionDate = activeVersion ? formatDate(activeVersion.imported_at) : "Sin version";
    const catalogName = activeVersion ? catalogTitleById.get(activeVersion.catalog_id) ?? activeVersion.title ?? "Listado" : "Sin listado";
    const rows = orderLines.map((line) => `${line.supplier_code ?? "S/COD"} - ${line.raw_description} x ${line.quantity}`);
    return [
      `Proveedor: ${selectedSupplier.name}`,
      `Listado/Version usada: ${catalogName} (${versionDate})`,
      "Items:",
      ...rows,
    ].join("\n");
  }, [selectedSupplier, activeVersion, catalogTitleById, orderLines]);

  const waLink = buildWhatsAppLink(selectedSupplier?.whatsapp, orderMessage);

  const addToOrder = (line: CatalogLine) => {
    const quantityToAdd = Math.max(1, Math.trunc(lineQuantities[line.id] ?? 1));
    setOrderItems((prev) => {
      const current = prev[line.id];
      const quantity = current ? current.quantity + quantityToAdd : quantityToAdd;
      return {
        ...prev,
        [line.id]: { ...line, quantity },
      };
    });
  };

  const updateLineQuantity = (lineId: string, value: string) => {
    const qty = Number(value);
    if (!Number.isFinite(qty)) return;
    setLineQuantities((prev) => ({ ...prev, [lineId]: Math.max(1, Math.trunc(qty)) }));
  };

  const updateOrderQuantity = (lineId: string, value: string) => {
    const qty = Number(value);
    if (!Number.isFinite(qty)) return;
    setOrderItems((prev) => {
      if (!prev[lineId]) return prev;
      return {
        ...prev,
        [lineId]: { ...prev[lineId], quantity: Math.max(1, Math.trunc(qty)) },
      };
    });
  };

  const removeOrderItem = (lineId: string) => {
    setOrderItems((prev) => {
      const { [lineId]: _, ...rest } = prev;
      return rest;
    });
  };

  const copyOrderMessage = async () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacio", description: "Agrega al menos un producto", variant: "destructive" });
      return;
    }

    await navigator.clipboard.writeText(orderMessage);
    toast({ title: "Mensaje copiado" });
  };

  const openWhatsApp = () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacio", description: "Agrega al menos un producto", variant: "destructive" });
      return;
    }

    if (!waLink) {
      toast({ title: "Proveedor sin WhatsApp", description: "Completa el numero para abrir WhatsApp", variant: "destructive" });
      return;
    }

    window.open(waLink, "_blank", "noopener,noreferrer");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
            <p className="text-muted-foreground">Gestion de proveedores y catalogos</p>
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

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[180px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No se encontraron proveedores</TableCell></TableRow>
              ) : suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_name ?? "-"}</TableCell>
                  <TableCell>{s.email ?? "-"}</TableCell>
                  <TableCell>{s.whatsapp ? `+${normalizeWhatsappNumber(s.whatsapp)}` : "-"}</TableCell>
                  <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openCatalog(s)} title="Catalogos"><Upload className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      {s.is_active ? (
                        <Button variant="ghost" size="icon" onClick={() => setSupplierToDelete(s)} title="Desactivar">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => restoreMutation.mutate(s.id)} title="Reactivar">
                          <RotateCcw className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>WhatsApp (opcional)</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="2991234567 o +542991234567" /></div>
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="px-0 text-muted-foreground">
                  Campos avanzados <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2"><Label>Contacto</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </CollapsibleContent>
            </Collapsible>
            <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent className="w-[96vw] max-w-[1400px] h-[92vh] overflow-hidden p-0">
          <Tabs
            value={catalogUiTab}
            onValueChange={(value) => setCatalogUiTab(value as "carga" | "historial" | "catalogo")}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="sticky top-0 z-20 border-b bg-background p-4">
              <DialogHeader><DialogTitle>Catalogos del proveedor: {selectedSupplier?.name}</DialogTitle></DialogHeader>
              <TabsList className="mt-3 grid w-full grid-cols-3">
                <TabsTrigger value="carga">Subir archivo</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
                <TabsTrigger value="catalogo">Buscar catalogo</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="carga" className="mt-0 min-h-0 flex-1 overflow-auto p-4">
              <Card className="mx-auto w-full max-w-3xl">
                <CardHeader><CardTitle className="text-base">Subir archivo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Titulo</Label>
                    <Input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} placeholder="Lista Febrero 2026 contado" />
                  </div>
                  <div className="space-y-2">
                    <Label>Agregar a listado existente (opcional)</Label>
                    <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Crear nuevo listado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Crear nuevo listado</SelectItem>
                        {catalogs.map((catalog) => (
                          <SelectItem key={catalog.id} value={catalog.id}>{catalog.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Input value={documentNotes} onChange={(e) => setDocumentNotes(e.target.value)} placeholder="Observaciones" />
                  </div>
                  <div className="space-y-2">
                    <Label>Archivo</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button onClick={() => uploadCatalogMutation.mutate()} disabled={uploadCatalogMutation.isPending || !selectedFile}>
                    {uploadCatalogMutation.isPending ? "Procesando..." : "Subir archivo"}
                  </Button>
                  {pdfProgress && (
                    <p className="text-xs text-muted-foreground">
                      {pdfProgress.message}
                    </p>
                  )}
                  {lastDiagnostics && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        Filas: {lastDiagnostics.keptRows}/{lastDiagnostics.totalRows}. Descartadas por descripcion vacia: {lastDiagnostics.dropped_missingDesc}, precio invalido: {lastDiagnostics.dropped_invalidPrice}, precio {"<="} 0: {lastDiagnostics.dropped_priceLE0}.
                      </p>
                      {lastDiagnostics.keptRows < 10 && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setDropDetailOpen(true)}
                        >
                          Ver detalle de filas descartadas
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historial" className="mt-0 min-h-0 flex-1 overflow-auto p-4">
              <Card className="mx-auto w-full max-w-5xl">
                <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {isHistoryLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : catalogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin listados cargados</p>
                  ) : catalogs.map((catalog) => (
                    <div key={catalog.id} className="rounded border p-3">
                      <p className="font-medium">{catalog.title}</p>
                      <p className="text-xs text-muted-foreground">Creado: {formatDate(catalog.created_at)}</p>
                      <div className="mt-2 space-y-2">
                        {(versionsByCatalog[catalog.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin versiones</p>
                        ) : (versionsByCatalog[catalog.id] ?? []).map((version) => (
                          <button
                            type="button"
                            key={version.id}
                            onClick={() => {
                              setActiveVersionId(version.id);
                              setCatalogSearch("");
                              setOrderItems({});
                              setLineQuantities({});
                              setCatalogUiTab("catalogo");
                            }}
                            className={`w-full rounded border p-2 text-left text-sm ${activeVersionId === version.id ? "border-primary bg-primary/5" : "border-border"}`}
                          >
                            <p className="font-medium">{version.title ?? catalog.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(version.imported_at)} - {version.file_name} - {version.file_type.toUpperCase()} - {version.line_count} lineas</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="catalogo" className="mt-0 min-h-0 flex-1 overflow-hidden p-4">
              <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="min-h-0 flex flex-col">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">Buscar en catalogos</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {activeVersion ? `Version activa: ${activeVersion.title ?? catalogTitleById.get(activeVersion.catalog_id) ?? "Listado"} (${formatDate(activeVersion.imported_at)})` : "Selecciona una version en el Historial"}
                    </p>
                    <Input placeholder="Buscar por descripcion o codigo" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} disabled={!activeVersionId} />
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0">
                    <div className="h-full min-h-0 overflow-auto rounded border">
                      <Table className="table-fixed min-w-[760px]">
                        <TableHeader className="sticky top-0 z-10 bg-background">
                          <TableRow>
                            <TableHead className="w-[140px]">Codigo</TableHead>
                            <TableHead>Descripcion</TableHead>
                            <TableHead className="w-[140px] text-right">Costo</TableHead>
                            <TableHead className="w-[110px]">Cantidad</TableHead>
                            <TableHead className="w-[120px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!activeVersionId ? (
                            <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Selecciona una version para ver lineas</TableCell></TableRow>
                          ) : isCatalogLoading ? (
                            <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                          ) : activeCatalogLines.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
                          ) : activeCatalogLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell className="font-mono text-xs truncate" title={line.supplier_code ?? "-"}>{line.supplier_code ?? "-"}</TableCell>
                              <TableCell className="text-sm truncate" title={line.raw_description}>{line.raw_description}</TableCell>
                              <TableCell className="text-right font-mono">{Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={lineQuantities[line.id] ?? 1}
                                  onChange={(e) => updateLineQuantity(line.id, e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Button size="sm" onClick={() => addToOrder(line)}>Agregar</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-h-0 flex flex-col">
                  <CardHeader><CardTitle className="text-base">Pedido actual</CardTitle></CardHeader>
                  <CardContent className="space-y-3 overflow-auto">
                    <div className="max-h-[42vh] space-y-2 overflow-auto">
                      {orderLines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin productos seleccionados</p>
                      ) : orderLines.map((line) => (
                        <div key={line.id} className="rounded border p-2 text-sm">
                          <p className="font-medium">{line.supplier_code ?? "S/COD"} - {line.raw_description}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} step={1} value={line.quantity} onChange={(e) => updateOrderQuantity(line.id, e.target.value)} className="h-8" />
                            <p className="text-muted-foreground">${Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                            <p className="font-medium">Subtotal: ${(line.cost * line.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                            <Button variant="ghost" size="sm" onClick={() => removeOrderItem(line.id)} className="ml-auto">Quitar</Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-sm font-semibold">Total: ${orderTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>

                    {!selectedSupplier?.whatsapp && (
                      <p className="text-sm text-amber-600">Este proveedor no tiene WhatsApp configurado.</p>
                    )}

                    <div className="grid gap-2">
                      <Button variant="outline" onClick={copyOrderMessage}><Copy className="mr-2 h-4 w-4" /> Copiar mensaje</Button>
                      <Button onClick={openWhatsApp}><MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

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
