import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { isRowEmpty, parsePrice } from "@/lib/importParserCore";
import { matchImportLine } from "@/lib/matching";
import { buildImportPreviewRows } from "@/features/imports/utils";
import type { ImportMappingState, ImportStep, ParsedRow } from "@/features/imports/types";

type ToastFn = (params: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type ImportLineInsert = {
  company_id: string;
  version_id: string;
  supplier_code: string | null;
  raw_description: string;
  price: number;
  item_id: string | null;
  match_status: "MATCHED" | "PENDING" | "NEW";
  match_reason: string;
};

const EMPTY_PRICE_LISTS: Array<{ id: string; name: string }> = [];

function isMissingMatchReasonColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return message.includes("match_reason") && message.includes("schema cache");
}

async function insertPriceListLines(batch: ImportLineInsert[]) {
  const { error } = await supabase.from("price_list_lines").insert(batch);
  if (!error) return;

  if (!isMissingMatchReasonColumn(error)) {
    throw error;
  }

  const fallbackBatch = batch.map(({ match_reason: _matchReason, ...line }) => line);
  const { error: fallbackError } = await supabase.from("price_list_lines").insert(fallbackBatch);
  if (fallbackError) throw fallbackError;
}

export function useImportsFlow(params: {
  currentCompanyId: string | null;
  toast: ToastFn;
}) {
  const { currentCompanyId, toast } = params;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ImportStep>("upload");
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMappingState>({
    supplier_code: "",
    description: "",
    price: "",
  });
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
  const selectedPriceListStillExists = priceLists.some(
    (priceList) => priceList.id === selectedPriceListId,
  );
  const previewData = buildImportPreviewRows(validRows, mapping);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const { parseImportFile } = await import("@/lib/importParser");
        const { headers: parsedHeaders, rows } = await parseImportFile(file);
        const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));

        if (nonEmptyRows.length === 0) {
          toast({
            title: "Archivo sin filas validas",
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
          description: error instanceof Error ? error.message : "Formato invalido o archivo corrupto",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const goPreview = () => {
    if (!mapping.description || !mapping.price) {
      toast({ title: "Mapea al menos descripcion y precio", variant: "destructive" });
      return;
    }

    if (validRows.length === 0) {
      toast({
        title: "No hay filas validas",
        description: "Subi un archivo con datos para continuar.",
        variant: "destructive",
      });
      return;
    }

    setStep("preview");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Selecciona una empresa activa para importar");
      if (!selectedPriceListStillExists) {
        throw new Error(
          "La lista seleccionada ya no esta disponible. Recarga Importaciones e intenta de nuevo",
        );
      }
      if (validRows.length === 0) {
        throw new Error("No hay filas validas para importar");
      }
      if (!selectedPriceListId) throw new Error("Selecciona una lista de precios");

      const { data: version, error: versionError } = await supabase
        .from("price_list_versions")
        .insert({
          company_id: currentCompanyId,
          price_list_id: selectedPriceListId,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (versionError) throw versionError;

      const { data: aliases, error: aliasesError } = await supabase
        .from("item_aliases")
        .select("item_id, alias, is_supplier_code")
        .eq("company_id", currentCompanyId);
      if (aliasesError) throw aliasesError;

      const allLines: ImportLineInsert[] = validRows
        .map((row) => {
          const supplierCode =
            mapping.supplier_code && mapping.supplier_code !== "__none__"
              ? (row[mapping.supplier_code] ?? "").trim()
              : "";
          const rawDescription = (row[mapping.description] ?? "").trim();
          const price = parsePrice(row[mapping.price] ?? "0");

          const match = matchImportLine({
            supplierCode,
            rawDescription,
            aliases: aliases ?? [],
          });

          const itemId = match.itemId;
          const matchStatus: "MATCHED" | "PENDING" | "NEW" = itemId ? "MATCHED" : "PENDING";

          return {
            company_id: currentCompanyId,
            version_id: version.id,
            supplier_code: supplierCode || null,
            raw_description: rawDescription,
            price,
            item_id: itemId,
            match_status: matchStatus,
            match_reason: match.reason,
          };
        })
        .filter((line) => line.raw_description);

      for (let index = 0; index < allLines.length; index += 500) {
        const batch = allLines.slice(index, index + 500);
        await insertPriceListLines(batch);
      }

      return {
        total: allLines.length,
        matched: allLines.filter((line) => line.match_status === "MATCHED").length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      setStep("done");
      toast({
        title: `Importacion completada: ${result.total} lineas, ${result.matched} matcheadas`,
      });
    },
    onError: (error: unknown) =>
      toast({
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
