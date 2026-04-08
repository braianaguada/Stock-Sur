import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LegacyCatalogTable } from "@/features/imports/components/LegacyCatalogTable";
import { supabase } from "@/integrations/supabase/client";
import { cleanText, normalizeAlias } from "@/lib/clean";
import type { ParsedRow } from "@/lib/importParserCore";

const LEGACY_IMPORT_DRAFT_KEY = "legacy-catalog-import-draft";
const INITIAL_VISIBLE_ROWS = 200;

type Row = {
  id: string;
  selected: boolean;
  codigo: string;
  articulo: string;
  medida: string;
  rubro: string;
  marca: string;
  searchText: string;
};

type ExtractLegacyRowsResult = {
  rows: Row[];
  skippedEmptyName: number;
};

type LegacyImportDraft = {
  rows: Row[];
  selectedIds: string[];
  rubroFilter: string;
  articleSearch: string;
  sourceFileName: string | null;
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function extractLegacyRows(rows: ParsedRow[], headers: string[]): ExtractLegacyRowsResult {
  const map = new Map(headers.map((header) => [normalizeHeader(header), header]));

  const codigoKey = map.get("codigo");
  const articuloKey = map.get("articulo");
  const medidaKey = map.get("medida");
  const rubroKey = map.get("rubro");
  const marcaKey = map.get("marca");

  if (!codigoKey || !articuloKey || !rubroKey) {
    throw new Error("Faltan columnas requeridas: Codigo, Articulo y Rubro");
  }

  const parsedRows: Row[] = [];
  let skippedEmptyName = 0;

  rows.forEach((row, index) => {
    const codigo = cleanText(row[codigoKey]);
    const articulo = cleanText(row[articuloKey]);
    const medida = medidaKey ? cleanText(row[medidaKey]) : "";
    const rubro = rubroKey ? cleanText(row[rubroKey]) : "";
    const marca = marcaKey ? cleanText(row[marcaKey]) : "";

    if (!articulo) {
      skippedEmptyName += 1;
      return;
    }

    if (!codigo) return;

    parsedRows.push({
      id: `${index}-${codigo}`,
      selected: true,
      codigo,
      articulo,
      medida,
      rubro,
      marca,
      searchText: [codigo, articulo, medida, rubro, marca]
        .map((value) => value.toLowerCase())
        .join(" "),
    });
  });

  return { rows: parsedRows, skippedEmptyName };
}

function loadLegacyImportDraft(): LegacyImportDraft | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(LEGACY_IMPORT_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LegacyImportDraft>;
    return {
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [],
      rubroFilter: typeof parsed.rubroFilter === "string" ? parsed.rubroFilter : "all",
      articleSearch: typeof parsed.articleSearch === "string" ? parsed.articleSearch : "",
      sourceFileName: typeof parsed.sourceFileName === "string" ? parsed.sourceFileName : null,
    };
  } catch {
    return null;
  }
}

function clearLegacyImportDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LEGACY_IMPORT_DRAFT_KEY);
}

async function importSelectedRows(
  rows: Row[],
  selectedIds: Set<string>,
  companyId: string,
  userId: string | null,
) {
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  if (selectedRows.length === 0) throw new Error("Selecciona al menos una fila para importar");

  const selectedCodes = Array.from(new Set(selectedRows.map((row) => normalizeAlias(row.codigo)).filter(Boolean)));

  const existingCodes = new Set<string>();
  for (let i = 0; i < selectedCodes.length; i += 300) {
    const chunk = selectedCodes.slice(i, i + 300);
    const { data: existingAliases, error: aliasesErr } = await supabase
      .from("item_aliases")
      .select("alias")
      .eq("company_id", companyId)
      .in("alias", chunk);
    if (aliasesErr) throw aliasesErr;

    (existingAliases ?? []).forEach((alias) => {
      existingCodes.add(normalizeAlias(alias.alias));
    });
  }

  const seenCodes = new Set<string>();
  const importableRows = selectedRows.filter((row) => {
    const key = normalizeAlias(row.codigo);
    if (!key || existingCodes.has(key) || seenCodes.has(key)) return false;
    seenCodes.add(key);
    return true;
  });

  let created = 0;
  for (let i = 0; i < importableRows.length; i += 300) {
    const batch = importableRows.slice(i, i + 300);
    const itemsPayload = batch.map((row) => ({
      company_id: companyId,
      name: cleanText(row.articulo),
      unit: cleanText(row.medida) || "un",
      category: cleanText(row.rubro) || null,
      brand: cleanText(row.marca) || null,
      is_active: true,
      created_by: userId,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("items")
      .insert(itemsPayload)
      .select("id");
    if (itemsErr) throw itemsErr;

    const aliasPayload = (insertedItems ?? []).map((item, idx) => ({
      company_id: companyId,
      item_id: item.id,
      alias: cleanText(batch[idx].codigo),
      is_supplier_code: true,
      created_by: userId,
    }));

    const validAliasPayload = aliasPayload.filter((entry) => entry.alias !== "");

    if (validAliasPayload.length > 0) {
      const { error: aliasErr } = await supabase
        .from("item_aliases")
        .upsert(validAliasPayload, { onConflict: "item_id,alias", ignoreDuplicates: true });
      if (aliasErr) throw aliasErr;
    }

    created += validAliasPayload.length;
  }

  return {
    selected: selectedRows.length,
    skipped: selectedRows.length - importableRows.length,
    created,
  };
}

export default function LegacyCatalogImportPage() {
  const { currentCompany, user } = useAuth();
  const initialDraft = loadLegacyImportDraft();
  const [rows, setRows] = useState<Row[]>(() => initialDraft?.rows ?? []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialDraft?.selectedIds ?? []));
  const [rubroFilter, setRubroFilter] = useState(initialDraft?.rubroFilter ?? "all");
  const [articleSearch, setArticleSearch] = useState(initialDraft?.articleSearch ?? "");
  const [sourceFileName, setSourceFileName] = useState<string | null>(initialDraft?.sourceFileName ?? null);
  const [visibleRowsCount, setVisibleRowsCount] = useState(INITIAL_VISIBLE_ROWS);
  const { toast } = useToast();
  const qc = useQueryClient();
  const deferredArticleSearch = useDeferredValue(articleSearch);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (rows.length === 0 && !sourceFileName) {
      clearLegacyImportDraft();
      return;
    }

    const draft: LegacyImportDraft = {
      rows,
      selectedIds: Array.from(selectedIds),
      rubroFilter,
      articleSearch,
      sourceFileName,
    };
    window.sessionStorage.setItem(LEGACY_IMPORT_DRAFT_KEY, JSON.stringify(draft));
  }, [articleSearch, rows, rubroFilter, selectedIds, sourceFileName]);

  const rubros = useMemo(() => {
    const all = new Set(rows.map((row) => row.rubro).filter(Boolean));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = deferredArticleSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const byRubro = rubroFilter === "all" || row.rubro === rubroFilter;
      const byArticle = !term || row.searchText.includes(term);
      return byRubro && byArticle;
    });
  }, [rows, rubroFilter, deferredArticleSearch]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleRowsCount),
    [filteredRows, visibleRowsCount],
  );

  useEffect(() => {
    setVisibleRowsCount(INITIAL_VISIBLE_ROWS);
  }, [deferredArticleSearch, rubroFilter, sourceFileName]);

  const importMutation = useMutation({
    mutationFn: async (variables: { rows: Row[]; selectedIds: Set<string> }) =>
      importSelectedRows(variables.rows, variables.selectedIds, currentCompany!.id, user?.id ?? null),
    onSuccess: ({ selected, skipped, created }) => {
      clearLegacyImportDraft();
      setRows([]);
      setSelectedIds(new Set());
      setRubroFilter("all");
      setArticleSearch("");
      setSourceFileName(null);
      toast({
        title: "Importacion completada",
        description: `Seleccionadas: ${selected}. Creadas: ${created}. Omitidas: ${skipped}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error al importar", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-count"] });
      qc.invalidateQueries({ queryKey: ["item-aliases"] });
    },
  });

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { parseImportFile } = await import("@/lib/importParser");
      const { headers, rows: parsedRows } = await parseImportFile(file);
      const { rows: extractedRows, skippedEmptyName } = extractLegacyRows(parsedRows, headers);

      if (skippedEmptyName > 0) {
        toast({
          title: "Filas omitidas",
          description: `Se omitieron ${skippedEmptyName} fila(s) sin nombre valido.`,
          variant: "destructive",
        });
      }

      if (extractedRows.length === 0) {
        setRows([]);
        setSelectedIds(new Set());
        setSourceFileName(file.name);
        toast({
          title: "Archivo sin filas importables",
          description: "No se encontraron filas validas con Codigo y Articulo limpios.",
          variant: "destructive",
        });
        return;
      }

      setRows(Array.isArray(extractedRows) ? extractedRows : []);
      setSelectedIds(new Set(extractedRows.filter((row) => row.selected).map((row) => row.id)));
      setRubroFilter("all");
      setArticleSearch("");
      setSourceFileName(file.name);
      setVisibleRowsCount(INITIAL_VISIBLE_ROWS);
    } catch (error) {
      toast({
        title: "No se pudo procesar el archivo",
        description: error instanceof Error ? error.message : "Verifica el formato del archivo",
        variant: "destructive",
      });
    }
  };

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const deselectAll = () => setSelectedIds(new Set());

  const importSelected = async () => {
    if (!currentCompany) {
      toast({
        title: "Empresa no disponible",
        description: "Selecciona una empresa antes de importar el catalogo legacy.",
        variant: "destructive",
      });
      return;
    }

    const rowsArray = Array.isArray(rows)
      ? rows
      : Array.isArray((rows as unknown as { rows?: Row[] })?.rows)
        ? (rows as unknown as { rows: Row[] }).rows
        : [];

    const selected = rowsArray.filter((row) => selectedIds.has(row.id));
    if (selected.length === 0) {
      toast({
        title: "No hay filas seleccionadas",
        description: "Selecciona al menos una fila para importar.",
        variant: "destructive",
      });
      return;
    }

    await importMutation.mutateAsync({ rows: rowsArray, selectedIds });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importador catalogo legacy</h1>
          <p className="text-muted-foreground">Subi CSV/XLS/XLSX para crear items y codigos de proveedor.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Archivo fuente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 rounded-lg border-2 border-dashed p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Columnas requeridas: Codigo, Articulo y Rubro. Medida y Marca son opcionales</p>
              <Input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="mx-auto max-w-xs" onChange={onFileUpload} />
              {sourceFileName ? (
                <p className="text-xs text-muted-foreground">
                  Archivo cargado en borrador: <span className="font-medium">{sourceFileName}</span>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {rows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview y seleccion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] space-y-2">
                  <Label>Filtrar por rubro</Label>
                  <Select value={rubroFilter} onValueChange={setRubroFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {rubros.map((rubro) => (
                        <SelectItem key={rubro} value={rubro}>{rubro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[260px] space-y-2">
                  <Label>Buscar por articulo</Label>
                  <Input
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Ej: Tornillo"
                  />
                </div>

                <div className="ml-auto text-sm text-muted-foreground">
                  Seleccionadas: {selectedIds.size} / {rows.length}
                  {filteredRows.length !== rows.length ? ` - Filtradas: ${filteredRows.length}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={selectFiltered}>Seleccionar filtrados</Button>
                <Button type="button" variant="outline" onClick={deselectAll}>Deseleccionar todo</Button>
                <Button type="button" onClick={importSelected} disabled={importMutation.isPending}>
                  Importar seleccionados
                </Button>
              </div>

              <div className="max-h-[60vh] overflow-auto rounded-lg border">
                <LegacyCatalogTable
                  rows={visibleRows}
                  selectedIds={selectedIds}
                  onSelectionChange={toggleSelection}
                />
              </div>

              {filteredRows.length > visibleRows.length ? (
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <p>
                    Mostrando {visibleRows.length} de {filteredRows.length} filas filtradas.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVisibleRowsCount((current) => current + INITIAL_VISIBLE_ROWS)}
                  >
                    Mostrar {Math.min(INITIAL_VISIBLE_ROWS, filteredRows.length - visibleRows.length)} mas
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
