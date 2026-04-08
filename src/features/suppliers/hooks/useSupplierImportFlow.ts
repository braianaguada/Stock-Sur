import type { MutableRefObject } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  NormalizeDiagnostics,
  ParsePdfProgress,
  ParsedSheetData,
} from "@/features/suppliers/types";
import { getErrorMessage } from "@/lib/errors";
import {
  loadStoredSupplierImportMapping,
  saveStoredSupplierImportMapping,
  toSupplierCatalogRpcLinePayload,
} from "@/features/suppliers/importPersistence";
import { logSupplierImportError } from "@/features/suppliers/logging";
import {
  LOW_CONFIDENCE_THRESHOLD,
  SHOULD_LOG_SUPPLIER_IMPORT,
} from "@/features/suppliers/constants";
import type {
  MappingColumnOption,
  MappingPreviewRow,
  MappingSelection,
} from "@/features/suppliers/components/ColumnMappingModal";
import type { PdfMappingSelection } from "@/features/suppliers/components/PdfMappingModal";
import type {
  ImportMappingStored,
  PdfImportMappingStored,
  OrderLine,
  Supplier,
  SupplierCatalog,
  SupplierCatalogLinePayload,
} from "@/features/suppliers/types";

type ToastFn = (params: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

export function useSupplierImportFlow(params: {
  currentCompanyId: string | null;
  selectedSupplier: Supplier | null;
  selectedFile: File | null;
  selectedCatalogId: string;
  documentTitle: string;
  documentNotes: string;
  catalogsById: Map<string, SupplierCatalog>;
  queryClient: QueryClient;
  setDocumentTitle: (value: string) => void;
  setDocumentNotes: (value: string) => void;
  setSelectedCatalogId: (value: string) => void;
  setSelectedFile: (file: File | null) => void;
  setPdfProgress: (value: ParsePdfProgress | null) => void;
  setLastDiagnostics: (value: NormalizeDiagnostics | null) => void;
  setActiveVersionId: (value: string | null) => void;
  setCatalogUiTab: (value: "carga" | "historial" | "catalogo") => void;
  setOrderItems: (value: Record<string, OrderLine>) => void;
  setLineQuantities: (value: Record<string, number>) => void;
  setMappingModalOpen: (value: boolean) => void;
  setMappingModalColumns: (value: MappingColumnOption[]) => void;
  setMappingModalPreviewRows: (value: MappingPreviewRow[]) => void;
  setMappingModalSuggested: (value: Omit<MappingSelection, "remember">) => void;
  setMappingModalConfidence: (value: number) => void;
  setPdfMappingOpen: (value: boolean) => void;
  setPdfMappingHeaders: (value: string[]) => void;
  setPdfMappingRows: (value: string[][]) => void;
  setPdfMappingSuggested: (value: Omit<PdfMappingSelection, "remember">) => void;
  xlsxMappingResolverRef: MutableRefObject<((value: MappingSelection | null) => void) | null>;
  pdfMappingResolverRef: MutableRefObject<((value: PdfMappingSelection | null) => void) | null>;
  toast: ToastFn;
}) {
  const {
    currentCompanyId,
    selectedSupplier,
    selectedFile,
    selectedCatalogId,
    documentTitle,
    documentNotes,
    catalogsById,
    queryClient,
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
  } = params;

  const requestXlsxMapping = (request: {
    headers: string[];
    previewRows: string[][];
    suggested: Omit<MappingSelection, "remember">;
    confidence: number;
  }) =>
    new Promise<MappingSelection | null>((resolve) => {
      setMappingModalColumns(request.headers.map((header) => ({ key: header, label: header })));
      setMappingModalPreviewRows(
        request.previewRows.slice(0, 30).map((row, index) => ({
          id: `row-${index}`,
          values: row,
        })),
      );
      setMappingModalSuggested(request.suggested);
      setMappingModalConfidence(request.confidence);
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

  const requestPdfMapping = (request: {
    headers: string[];
    rows: string[][];
    suggested: Omit<PdfMappingSelection, "remember">;
  }) =>
    new Promise<PdfMappingSelection | null>((resolve) => {
      setPdfMappingHeaders(request.headers);
      setPdfMappingRows(request.rows.slice(0, 60));
      setPdfMappingSuggested(request.suggested);
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

  const uploadCatalogMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Selecciona una empresa para importar catalogos");
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
      if (requestedCatalogId && !catalogsById.has(requestedCatalogId)) {
        throw new Error(
          "El listado seleccionado ya no esta disponible. Recarga el historial e intenta de nuevo",
        );
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

      const { data: document, error: documentError } = await supabase
        .from("supplier_documents")
        .insert({
          company_id: currentCompanyId,
          supplier_id: selectedSupplier.id,
          title,
          file_name: selectedFile.name,
          file_type: fileType,
          notes: documentNotes.trim() || null,
        })
        .select("id")
        .single();
      if (documentError) {
        logSupplierImportError("insert_document", documentError, { userId, requestedCatalogId });
        throw documentError;
      }

      const supplierDocumentId = document.id;
      let lines: SupplierCatalogLinePayload[] = [];
      let diagnostics: NormalizeDiagnostics | null = null;

      if (isXlsx || isText) {
        const { parseImportFile } = await import("@/lib/importParser");
        const { detectColumnsHeuristic, normalizeRowsToLines, parseXlsxToRows } = await import(
          "@/lib/importers/catalogImporter"
        );

        let parsedSheet: ParsedSheetData;
        if (isXlsx) {
          parsedSheet = await parseXlsxToRows(selectedFile);
        } else {
          const parsed = await parseImportFile(selectedFile);
          const rows = parsed.rows.map((row) =>
            parsed.headers.map((header) => String(row[header] ?? "")),
          );
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
          currentCompanyId,
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

        const missingDescriptionRatio =
          diagnostics.totalRows > 0 ? diagnostics.dropped_missingDesc / diagnostics.totalRows : 0;
        const needsManualMapping =
          detected.confidence < LOW_CONFIDENCE_THRESHOLD ||
          diagnostics.keptRows < 10 ||
          missingDescriptionRatio > 0.5;

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
              await saveStoredSupplierImportMapping(currentCompanyId, selectedSupplier.id, "xlsx", {
                descriptionColumn: mapping.descriptionColumn,
                priceColumn: mapping.priceColumn,
                currencyColumn: mapping.currencyColumn,
                supplierCodeColumn: mapping.supplierCodeColumn,
              } satisfies ImportMappingStored);
            } catch (error) {
              logSupplierImportError("save_mapping", error, {
                supplierId: selectedSupplier.id,
                fileType: "xlsx",
              });
            }
          }
        }

        lines = normalized.lines.map(toSupplierCatalogRpcLinePayload);
      } else if (isPdf) {
        const {
          DEFAULT_PDF_OPTIONS,
          detectColumnsHeuristic,
          parseFlexibleNumber,
          parsePdfToLines,
        } = await import(
          "@/lib/importers/catalogImporter"
        );
        const parseResultNative = await parsePdfToLines(
          selectedFile,
          DEFAULT_PDF_OPTIONS,
          (progress) => setPdfProgress(progress),
        );
        let parseResult = parseResultNative;

        const {
          extractSupplierPdfWithAi,
          scorePdfExtractionResult,
          shouldTryAiPdfExtraction,
        } = await import("@/features/suppliers/aiPdfExtraction");

        if (shouldTryAiPdfExtraction(parseResultNative)) {
          setPdfProgress({
            phase: "ai",
            currentPage: 1,
            totalPages: 1,
            message: "Probando extraccion asistida con IA para mejorar el PDF...",
          });

          try {
            const aiResult = await extractSupplierPdfWithAi(selectedFile);
            if (
              aiResult &&
              scorePdfExtractionResult(aiResult) > scorePdfExtractionResult(parseResultNative) * 1.1
            ) {
              parseResult = aiResult;
            }
          } catch (aiError) {
            logSupplierImportError("pdf_ai_extract", aiError, {
              supplierId: selectedSupplier.id,
              fileName: selectedFile.name,
            });
          }
        }

        const tableHeaders = parseResult.table?.headers ?? [];
        const tableRows = parseResult.table?.rows ?? [];

        if (tableHeaders.length === 0 || tableRows.length === 0) {
          if (parseResult.lines.length === 0) throw new Error("No se pudo extraer contenido del PDF");
          lines = parseResult.lines.map(toSupplierCatalogRpcLinePayload);
        } else {
          const stored = await loadStoredSupplierImportMapping<PdfImportMappingStored>(
            currentCompanyId,
            selectedSupplier.id,
            "pdf",
          );
          const detected = detectColumnsHeuristic(tableHeaders, tableRows);
          const detectedCodeColumn =
            detected.supplierCodeColumn && tableHeaders.includes(detected.supplierCodeColumn)
              ? detected.supplierCodeColumn
              : tableHeaders.find((header) => /codigo|c[oó]digo|cod|sku|ref/i.test(header)) ?? null;
          const suggested: Omit<PdfMappingSelection, "remember"> = {
            descriptionColumn:
              stored?.descriptionColumn ??
              detected.descriptionColumn ??
              tableHeaders.find((header) => /description|descripcion|producto|detalle|item/i.test(header)) ??
              tableHeaders[0] ??
              "col_1",
            priceColumn:
              stored?.priceColumn ??
              detected.priceColumn ??
              tableHeaders.find((header) => /precio|price|cost|importe|lista|\$/i.test(header)) ??
              tableHeaders[Math.min(1, tableHeaders.length - 1)] ??
              "col_1",
            codeColumn: stored?.codeColumn ?? detectedCodeColumn,
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
          const descriptionIndex = indexByHeader.get(selection.descriptionColumn);
          const priceIndex = indexByHeader.get(selection.priceColumn);
          const codeIndex = selection.codeColumn
            ? indexByHeader.get(selection.codeColumn)
            : undefined;
          if (descriptionIndex === undefined || priceIndex === undefined) {
            throw new Error("Mapeo PDF invalido");
          }

          const parsedLines: SupplierCatalogLinePayload[] = [];
          tableRows.forEach((row, index) => {
            const rawDescription = String(row[descriptionIndex] ?? "")
              .replace(/\s+/g, " ")
              .trim();
            const priceRaw = String(row[priceIndex] ?? "").trim();
            const parsed = parseFlexibleNumber(priceRaw);
            if (!rawDescription) return;
            if (selection.filterRowsWithoutPrice && parsed === null) return;
            if (parsed === null || parsed <= 0) return;

            const supplierCode =
              codeIndex !== undefined ? String(row[codeIndex] ?? "").trim() : "";
            parsedLines.push({
              supplier_code: supplierCode || null,
              raw_description: rawDescription,
              normalized_description: rawDescription.toLowerCase(),
              cost: parsed,
              currency: /usd|u\$s/i.test(priceRaw) ? "USD" : "ARS",
              row_index: index + 1,
              matched_item_id: null,
              match_status: "PENDING",
            });
          });
          lines = parsedLines;

          if (selection.remember) {
            try {
              await saveStoredSupplierImportMapping(currentCompanyId, selectedSupplier.id, "pdf", {
                descriptionColumn: selection.descriptionColumn,
                priceColumn: selection.priceColumn,
                codeColumn: selection.codeColumn,
                preferPriceAtEnd: selection.preferPriceAtEnd,
                filterRowsWithoutPrice: selection.filterRowsWithoutPrice,
              } satisfies PdfImportMappingStored);
            } catch (error) {
              logSupplierImportError("save_mapping", error, {
                supplierId: selectedSupplier.id,
                fileType: "pdf",
              });
            }
          }
        }
      }

      setPdfProgress(null);
      setLastDiagnostics(diagnostics);
      if (lines.length === 0) throw new Error("No se encontraron filas validas para importar");

      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "create_supplier_catalog_import",
        {
          p_supplier_id: selectedSupplier.id,
          p_supplier_document_id: supplierDocumentId,
          p_catalog_id: requestedCatalogId,
          p_catalog_title: requestedCatalogId ? null : title,
          p_catalog_notes: documentNotes.trim() || null,
          p_version_title: title,
          p_lines: lines,
        },
      );
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
      return {
        total: response.inserted_count ?? lines.length,
        versionId: response.version_id ?? null,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-catalogs", selectedSupplier?.id] });
      queryClient.invalidateQueries({
        queryKey: ["supplier-catalog-versions", selectedSupplier?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["supplier-catalog-lines"] });
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
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  return {
    requestXlsxMapping,
    closeMappingModal,
    confirmMappingModal,
    requestPdfMapping,
    closePdfMappingModal,
    confirmPdfMappingModal,
    uploadCatalogMutation,
  };
}
