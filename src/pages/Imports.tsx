import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check } from "lucide-react";
import { parseImportFile, parsePrice, type ParsedRow, isRowEmpty } from "@/lib/importParser";

type Step = "upload" | "map" | "preview" | "done";


export default function ImportsPage() {
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ supplier_code: "", description: "", price: "" });
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: priceLists = [] } = useQuery({
    queryKey: ["price-lists-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_lists").select("id, name, supplier_id").order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { headers: parsedHeaders, rows } = await parseImportFile(file);
      setHeaders(parsedHeaders);
      setRawRows(rows);
      setMapping({ supplier_code: "", description: "", price: "" });
      setStep("map");
    } catch (error) {
      console.error("Error leyendo archivo de importación", { fileName: file.name, error });
      toast({
        title: "No se pudo leer el archivo",
        description: error instanceof Error ? error.message : "Formato inválido o archivo corrupto",
        variant: "destructive",
      });
    }
  }, [toast]);

  const goPreview = () => {
    if (!mapping.description || !mapping.price) {
      toast({ title: "Mapea al menos descripción y precio", variant: "destructive" });
      return;
    }
    setStep("preview");
  };


  const validRows = rawRows.filter((row) => !isRowEmpty(row));

  const previewData = validRows.slice(0, 50).map((row) => ({
    supplier_code: mapping.supplier_code && mapping.supplier_code !== "__none__" ? row[mapping.supplier_code] ?? "" : "",
    raw_description: row[mapping.description] ?? "",
    price: parsePrice(row[mapping.price] ?? "0"),
  }));

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPriceListId) throw new Error("Seleccioná una lista de precios");

      // Create version
      const { data: version, error: vErr } = await supabase
        .from("price_list_versions")
        .insert({ price_list_id: selectedPriceListId, notes: notes || null })
        .select("id")
        .single();
      if (vErr) throw vErr;

      // Fetch aliases for matching
      const { data: aliases } = await supabase.from("item_aliases").select("item_id, alias, is_supplier_code");

      const allLines = validRows.map((row) => {
        const supplierCode = mapping.supplier_code && mapping.supplier_code !== "__none__"
          ? (row[mapping.supplier_code] ?? "").trim()
          : "";
        const rawDesc = (row[mapping.description] ?? "").trim();
        const price = parsePrice(row[mapping.price] ?? "0");

        let item_id: string | null = null;
        let match_status: "MATCHED" | "PENDING" | "NEW" = "PENDING";

        // Try matching by supplier code
        if (supplierCode && aliases) {
          const match = aliases.find((a) => a.is_supplier_code && a.alias.toLowerCase() === supplierCode.toLowerCase());
          if (match) { item_id = match.item_id; match_status = "MATCHED"; }
        }

        // Try matching by description alias
        if (!item_id && aliases) {
          const descNorm = rawDesc.toLowerCase();
          const match = aliases.find((a) => descNorm.includes(a.alias.toLowerCase()));
          if (match) { item_id = match.item_id; match_status = "MATCHED"; }
        }

        return {
          version_id: version.id,
          supplier_code: supplierCode || null,
          raw_description: rawDesc,
          price,
          item_id,
          match_status,
        };
      }).filter((l) => l.raw_description);

      // Insert in batches of 500
      for (let i = 0; i < allLines.length; i += 500) {
        const batch = allLines.slice(i, i + 500);
        const { error } = await supabase.from("price_list_lines").insert(batch);
        if (error) throw error;
      }

      return { total: allLines.length, matched: allLines.filter((l) => l.match_status === "MATCHED").length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["price-lists"] });
      setStep("done");
      toast({ title: `Importación completada: ${result.total} líneas, ${result.matched} matcheadas` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reset = () => {
    setStep("upload");
    setRawRows([]);
    setHeaders([]);
    setMapping({ supplier_code: "", description: "", price: "" });
    setSelectedPriceListId("");
    setNotes("");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importaciones</h1>
          <p className="text-muted-foreground">Importar listas de precios desde CSV o XLSX</p>
        </div>

        {step === "upload" && (
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-lg">Subir archivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Lista de precios *</Label>
                <Select value={selectedPriceListId} onValueChange={setSelectedPriceListId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lista" /></SelectTrigger>
                  <SelectContent>
                    {priceLists.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Lista marzo 2026" />
              </div>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">Arrastrá o seleccioná un archivo CSV/XLSX</p>
                <Input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="max-w-xs mx-auto" />
              </div>
            </CardContent>
          </Card>
        )}

        {step === "map" && (
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-lg">Mapeo de columnas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{validRows.length} filas válidas detectadas. Mapeá las columnas:</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Código proveedor (opcional)</Label>
                  <Select value={mapping.supplier_code} onValueChange={(v) => setMapping({ ...mapping, supplier_code: v })}>
                    <SelectTrigger><SelectValue placeholder="No mapear" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No mapear</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descripción *</Label>
                  <Select value={mapping.description} onValueChange={(v) => setMapping({ ...mapping, description: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Precio *</Label>
                  <Select value={mapping.price} onValueChange={(v) => setMapping({ ...mapping, price: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>Volver</Button>
                <Button onClick={goPreview}>Previsualizar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Mostrando primeras {previewData.length} de {validRows.length} filas válidas</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("map")}>Volver</Button>
                <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                  {importMutation.isPending ? "Importando..." : `Confirmar importación (${validRows.length} filas)`}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-card overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cód. Proveedor</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{row.supplier_code || "—"}</TableCell>
                      <TableCell className="text-sm">{row.raw_description}</TableCell>
                      <TableCell className="text-right font-mono">{row.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "done" && (
          <Card className="max-w-lg">
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Importación completada</h2>
              <p className="text-muted-foreground">Las líneas fueron importadas. Revisá los pendientes en la sección correspondiente.</p>
              <Button onClick={reset}>Nueva importación</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
