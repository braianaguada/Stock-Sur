import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseImportFile, parsePrice, type ParsedRow } from "@/lib/importParser";
import { cleanText, normalizeAlias } from "@/lib/clean";

type Row = {
  id: string;
  selected: boolean;
  codigo: string;
  articulo: string;
  medida: string;
  rubro: string;
  marca: string;
  costo_num: number;
};

type ExtractLegacyRowsResult = {
  rows: Row[];
  skippedEmptyName: number;
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
  const costoNumKey = map.get("costonum") ?? map.get("costo");

  if (!codigoKey || !articuloKey || !rubroKey || !costoNumKey) {
    throw new Error("Faltan columnas requeridas: Código, Artículo, Rubro y Costo_num (o Costo)");
  }

  const parsedRows: Row[] = [];
  let skippedEmptyName = 0;

  rows.forEach((row, index) => {
    const codigo = cleanText(row[codigoKey]);
    const articulo = cleanText(row[articuloKey]);
    const medida = medidaKey ? cleanText(row[medidaKey]) : "";
    const rubro = rubroKey ? cleanText(row[rubroKey]) : "";
    const marca = marcaKey ? cleanText(row[marcaKey]) : "";
    const costo = parsePrice(String(row[costoNumKey] ?? ""));

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
      costo_num: costo,
    });
  });

  return { rows: parsedRows, skippedEmptyName };
}


async function itemsHaveCostField(): Promise<boolean> {
  const { error } = await supabase.from("items").select("id, cost").limit(1);
  if (!error) return true;
  if (error.message.toLowerCase().includes("column") && error.message.toLowerCase().includes("cost")) {
    return false;
  }
  throw error;
}

async function importSelectedRows(rows: Row[], selectedIds: Set<string>) {
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  if (selectedRows.length === 0) throw new Error("Seleccioná al menos una fila para importar");

  const supportsCost = await itemsHaveCostField();
  const selectedCodes = Array.from(new Set(selectedRows.map((row) => normalizeAlias(row.codigo)).filter(Boolean)));

  const existingCodes = new Set<string>();
  for (let i = 0; i < selectedCodes.length; i += 300) {
    const chunk = selectedCodes.slice(i, i + 300);
    const { data: existingAliases, error: aliasesErr } = await supabase
      .from("item_aliases")
      .select("alias")
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
    const itemsPayload = batch.map((row) => {
      const payload: Record<string, unknown> = {
        name: cleanText(row.articulo),
        unit: cleanText(row.medida) || "un",
        category: cleanText(row.rubro) || null,
        brand: cleanText(row.marca) || null,
        is_active: true,
      };

      if (supportsCost) payload.cost = row.costo_num;
      return payload;
    });

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("items")
      .insert(itemsPayload)
      .select("id");
    if (itemsErr) throw itemsErr;

    const aliasPayload = (insertedItems ?? []).map((item, idx) => ({
      item_id: item.id,
      alias: cleanText(batch[idx].codigo),
      is_supplier_code: true,
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
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rubroFilter, setRubroFilter] = useState("all");
  const [articleSearch, setArticleSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const rubros = useMemo(() => {
    const all = new Set(rows.map((row) => row.rubro).filter(Boolean));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = articleSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const byRubro = rubroFilter === "all" || row.rubro === rubroFilter;
      const byArticle = !term || row.articulo.toLowerCase().includes(term);
      return byRubro && byArticle;
    });
  }, [rows, rubroFilter, articleSearch]);

  const importMutation = useMutation({
    mutationFn: async (variables: { rows: Row[]; selectedIds: Set<string> }) =>
      importSelectedRows(variables.rows, variables.selectedIds),
    onSuccess: ({ selected, skipped, created }) => {
      toast({
        title: "Importación completada",
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
      const { headers, rows: parsedRows } = await parseImportFile(file);
      const { rows: extractedRows, skippedEmptyName } = extractLegacyRows(parsedRows, headers);

      if (skippedEmptyName > 0) {
        toast({
          title: "Filas omitidas",
          description: `Se omitieron ${skippedEmptyName} fila(s) sin nombre válido.`,
          variant: "destructive",
        });
      }

      if (extractedRows.length === 0) {
        setRows([]);
        setSelectedIds(new Set());
        toast({
          title: "Archivo sin filas importables",
          description: "No se encontraron filas válidas con Código y Artículo limpios.",
          variant: "destructive",
        });
        return;
      }

      setRows(Array.isArray(extractedRows) ? extractedRows : []);
      setSelectedIds(new Set(extractedRows.filter((row) => row.selected).map((row) => row.id)));
      setRubroFilter("all");
      setArticleSearch("");
    } catch (error) {
      toast({
        title: "No se pudo procesar el archivo",
        description: error instanceof Error ? error.message : "Verificá el formato del archivo",
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
    const rowsArray = Array.isArray(rows)
      ? rows
      : Array.isArray((rows as unknown as { rows?: Row[] })?.rows)
      ? (rows as unknown as { rows: Row[] }).rows
      : [];

    const selected = rowsArray.filter((row) => selectedIds.has(row.id));
    if (selected.length === 0) {
      toast({
        title: "No hay filas seleccionadas",
        description: "Seleccioná al menos una fila para importar.",
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
          <h1 className="text-2xl font-bold tracking-tight">Importador catálogo legacy</h1>
          <p className="text-muted-foreground">Subí CSV/XLS/XLSX para crear ítems y códigos de proveedor.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Archivo fuente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Columnas requeridas: Código, Artículo, Rubro, Costo_num (o Costo). Medida es opcional</p>
              <Input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="max-w-xs mx-auto" onChange={onFileUpload} />
            </div>
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview y selección</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-2 min-w-[220px]">
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

                <div className="space-y-2 min-w-[260px]">
                  <Label>Buscar por artículo</Label>
                  <Input
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Ej: Tornillo"
                  />
                </div>

                <div className="ml-auto text-sm text-muted-foreground">
                  Seleccionadas: {selectedIds.size} / {rows.length}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={selectFiltered}>Seleccionar filtrados</Button>
                <Button type="button" variant="outline" onClick={deselectAll}>Deseleccionar todo</Button>
                <Button type="button" onClick={importSelected} disabled={importMutation.isPending}>
                  Importar seleccionados
                </Button>
              </div>

              <div className="rounded-lg border overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[56px]">Sel.</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Artículo</TableHead>
                      <TableHead>Medida</TableHead>
                      <TableHead>Rubro</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={(checked) => toggleSelection(row.id, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                        <TableCell>{row.articulo}</TableCell>
                        <TableCell>{row.medida}</TableCell>
                        <TableCell>{row.rubro || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{row.costo_num.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
