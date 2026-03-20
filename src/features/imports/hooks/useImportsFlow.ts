import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { isRowEmpty, parseImportFile, parsePrice } from "@/lib/importParser";
import { matchImportLine } from "@/lib/matching";
import { buildImportPreviewRows } from "@/features/imports/utils";
import type { ImportMappingState, ImportStep, ParsedRow } from "@/features/imports/types";

type ToastFn = (params: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

const EMPTY_PRICE_LISTS: Array<{ id: string; name: string }> = [];

export function useImportsFlow(params: {
  currentCompanyId: string | null;
  toast: ToastFn;
}) {
  const { currentCompanyId, toast } = params;
  const qc = useQueryClient();

  const [step, setStep] = useState<ImportStep>("upload");
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMappingState>({ supplier_code: "", description: "", price: "" });
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [notes, setNotes] = useState("");

  const priceListsQuery = useQuery({
    queryKey: ["price-lists-simple", currentCompanyId ?? "no-company"],
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const priceLists = priceListsQuery.data ?? EMPTY_PRICE_LISTS;

  const validRows = rawRows.filter((row) => !isRowEmpty(row));
  const selectedPriceListStillExists = priceLists.some((priceList) => priceList.id === selectedPriceListId);
  const previewData = buildImportPreviewRows(validRows, mapping);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { headers: parsedHeaders, rows } = await parseImportFile(file);
      const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));

      if (nonEmptyRows.length === 0) {
        toast({
          title: "Archivo sin filas válidas",
          description: "El archivo no contiene datos para importar.",
          variant: "destructive",
        });
        return;
      }

      setHeaders(parsedHeaders);
      setRawRows(rows);
      setMapping({ supplier_code: "", description: "", price: "" });
      setStep("map");
    } catch (error) {
      toast({
        title: "No se pudo leer el archivo",
        description: error instanceof Error ? error.message : "Formato inválido o archivo corrupto",
        variant: "destructive",
      });
    }
  }, [toast]);

  const goPreview = () => {
    if (!mapping.description || !mapping.price) {
      toast({ title: "Mapeá al menos descripción y precio", variant: "destructive" });
      return;
    }

    if (validRows.length === 0) {
      toast({ title: "No hay filas válidas", description: "Subí un archivo con datos para continuar.", variant: "destructive" });
      return;
    }

    setStep("preview");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Seleccioná una empresa activa para importar");
      if (!selectedPriceListStillExists) {
        throw new Error("La lista seleccionada ya no está disponible. Recargá Importaciones e intentá de nuevo");
      }
      if (validRows.length === 0) {
        throw new Error("No hay filas válidas para importar");
      }
      if (!selectedPriceListId) throw new Error("Seleccioná una lista de precios");

      const { data: version, error: vErr } = await supabase
        .from("price_list_versions")
        .insert({ company_id: currentCompanyId, price_list_id: selectedPriceListId, notes: notes || null })
        .select("id")
        .single();
      if (vErr) throw vErr;

      const { data: aliases, error: aliasesError } = await supabase
        .from("item_aliases")
        .select("item_id, alias, is_supplier_code")
        .eq("company_id", currentCompanyId);
      if (aliasesError) throw aliasesError;

      const allLines = validRows.map((row) => {
        const supplierCode = mapping.supplier_code && mapping.supplier_code !== "__none__"
          ? (row[mapping.supplier_code] ?? "").trim()
          : "";
        const rawDesc = (row[mapping.description] ?? "").trim();
        const price = parsePrice(row[mapping.price] ?? "0");

        const match = matchImportLine({
          supplierCode,
          rawDescription: rawDesc,
          aliases: aliases ?? [],
        });

        const item_id = match.itemId;
        const match_status: "MATCHED" | "PENDING" | "NEW" = item_id ? "MATCHED" : "PENDING";

        return {
          company_id: currentCompanyId,
          version_id: version.id,
          supplier_code: supplierCode || null,
          raw_description: rawDesc,
          price,
          item_id,
          match_status,
          match_reason: match.reason,
        };
      }).filter((line) => line.raw_description);

      for (let i = 0; i < allLines.length; i += 500) {
        const batch = allLines.slice(i, i + 500);
        const { error } = await supabase.from("price_list_lines").insert(batch);
        if (error) throw error;
      }

      return {
        total: allLines.length,
        matched: allLines.filter((line) => line.match_status === "MATCHED").length,
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["price-lists"] });
      setStep("done");
      toast({ title: `Importación completada: ${result.total} líneas, ${result.matched} matcheadas` });
    },
    onError: (error: unknown) => toast({
      title: "Error",
      description: getErrorMessage(error),
      variant: "destructive",
    }),
  });

  const reset = () => {
    setStep("upload");
    setRawRows([]);
    setHeaders([]);
    setMapping({ supplier_code: "", description: "", price: "" });
    setSelectedPriceListId("");
    setNotes("");
  };

  return {
    goPreview,
    handleFileUpload,
    headers,
    importMutation,
    mapping,
    notes,
    previewData,
    priceLists,
    rawRows,
    reset,
    selectedPriceListId,
    setMapping,
    setNotes,
    setSelectedPriceListId,
    setStep,
    step,
    validRows,
  };
}
