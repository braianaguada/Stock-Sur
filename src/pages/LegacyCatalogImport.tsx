import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { parseImportFile, parsePrice, type ParsedRow } from "@/lib/importParser";
import { supabase } from "@/integrations/supabase/client";

type LegacyRow = {
  id: string;
  codigo: string;
  articulo: string;
  medida: string;
  rubro: string;
  costo: number;
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function extractLegacyRows(rows: ParsedRow[], headers: string[]) {
  const map = new Map(headers.map((header) => [normalizeHeader(header), header]));

  const codigoKey = map.get("codigo");
  const articuloKey = map.get("articulo");
  const medidaKey = map.get("medida");
  const rubroKey = map.get("rubro");
  const costoNumKey = map.get("costonum") ?? map.get("costo");

  if (!codigoKey || !articuloKey || !medidaKey || !rubroKey || !costoNumKey) {
    throw new Error("Faltan columnas requeridas: Código, Artículo, Medida, Rubro y Costo_num (o Costo)");
  }

  const parsedRows: LegacyRow[] = [];
  rows.forEach((row, index) => {
    const codigo = String(row[codigoKey] ?? "").trim();
    const articulo = String(row[articuloKey] ?? "").trim();
    const medida = String(row[medidaKey] ?? "").trim();
    const rubro = String(row[rubroKey] ?? "").trim();
    const costo = parsePrice(String(row[costoNumKey] ?? ""));

    if (!codigo || !articulo) return;

    parsedRows.push({
      id: `${index}-${codigo}`,
      codigo,
      articulo,
      medida: medida || "un",
      rubro,
      costo,
    });
  });

  return parsedRows;
}

async function itemsHaveCostField(): Promise<boolean> {
  const { error } = await supabase.from("items").select("id, cost").limit(1);
  if (!error) return true;
  if (error.message.toLowerCase().includes("column") && error.message.toLowerCase().includes("cost")) {
    return false;
  }
  throw error;
}

async function importSelected(rows: LegacyRow[], selectedIds: Set<string>) {
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  if (selectedRows.length === 0) throw new Error("Seleccioná al menos una fila para importar");

  const supportsCost = await itemsHaveCostField();
  const selectedCodes = Array.from(new Set(selectedRows.map((row) => row.codigo.trim()).filter(Boolean)));

  const existingCodes = new Set<string>();
  for (let i = 0; i < selectedCodes.length; i += 300) {
    const chunk = selectedCodes.slice(i, i + 300);
    const { data: existingAliases, error: aliasesErr } = await supabase
      .from("item_aliases")
      .select("alias")
      .in("alias", chunk);
    if (aliasesErr) throw aliasesErr;

    (existingAliases ?? []).forEach((alias) => {
      existingCodes.add(alias.alias.trim().toLowerCase());
    });
  }

  const seenCodes = new Set<string>();
  const importableRows = selectedRows.filter((row) => {
    const key = row.codigo.trim().toLowerCase();
    if (!key || existingCodes.has(key) || seenCodes.has(key)) return false;
    seenCodes.add(key);
    return true;
  });

  let created = 0;
  for (let i = 0; i < importableRows.length; i += 300) {
    const batch = importableRows.slice(i, i + 300);
    const itemsPayload = batch.map((row) => {
      const payload: Record<string, unknown> = {
        name: row.articulo,
        unit: row.medida || "un",
        category: row.rubro || null,
        is_active: true,
      };

      if (supportsCost) payload.cost = row.costo;
      return payload;
    });

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("items")
      .insert(itemsPayload)
      .select("id");
    if (itemsErr) throw itemsErr;

    const aliasPayload = (insertedItems ?? []).map((item, idx) => ({
      item_id: item.id,
      alias: batch[idx].codigo,
      is_supplier_code: true,
    }));

    if (aliasPayload.length > 0) {
      const { error: aliasErr } = await supabase.from("item_aliases").insert(aliasPayload);
      if (aliasErr) throw aliasErr;
    }

    created += aliasPayload.length;
  }

  return {
    selected: selectedRows.length,
    skipped: selectedRows.length - importableRows.length,
    created,
  };
}

export default function LegacyCatalogImportPage() {
  const [rows, setRows] = useState<LegacyRow[]>([]);
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
    mutationFn: async () => importSelected(rows, selectedIds),
    onSuccess: ({ selected, skipped, created }) => {
      toast({
        title: "Importación finalizada",
        description: `Seleccionadas: ${selected}. Creadas: ${created}. Saltadas por duplicado: ${skipped}.`,
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
      const extractedRows = extractLegacyRows(parsedRows, headers);
      setRows(extractedRows);
      setSelectedIds(new Set(extractedRows.map((row) => row.id)));
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
              <p className="text-sm text-muted-foreground">Columnas requeridas: Código, Artículo, Medida, Rubro, Costo_num (o Costo)</p>
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
                <Button type="button" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || selectedIds.size === 0}>
                  {importMutation.isPending ? "Importando..." : "Importar seleccionados"}
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
                        <TableCell className="text-right font-mono">{row.costo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
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
