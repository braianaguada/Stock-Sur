import { useMemo, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Upload, MessageCircle, Copy, ChevronDown } from "lucide-react";
import { parseImportFile, parsePrice, isRowEmpty } from "@/lib/importParser";
import { matchImportLine } from "@/lib/matching";
import { buildWhatsAppLink, normalizeWhatsappNumber } from "@/lib/whatsapp";

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
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
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

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("*").order("name");
      if (search) q = q.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: catalogs = [] } = useQuery({
    queryKey: ["supplier-catalogs", selectedSupplier?.id],
    enabled: !!selectedSupplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalogs")
        .select("id, title, created_at")
        .eq("supplier_id", selectedSupplier!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierCatalog[];
    },
  });

  const { data: catalogVersions = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["supplier-catalog-versions", selectedSupplier?.id],
    enabled: !!selectedSupplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog_versions")
        .select("id, catalog_id, title, imported_at, supplier_document_id")
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
    queryKey: ["supplier-catalog-lines", activeVersionId, catalogSearch],
    enabled: !!activeVersionId,
    queryFn: async () => {
      let query = supabase
        .from("supplier_catalog_lines")
        .select("id, supplier_code, raw_description, cost, currency")
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
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
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
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor eliminado" });
    },
  });

  const uploadCatalogMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSupplier) throw new Error("Seleccioná un proveedor");
      if (!selectedFile) throw new Error("Seleccioná un archivo");

      const extension = selectedFile.name.split(".").pop()?.toLowerCase();
      const fileType = extension === "pdf" ? "pdf" : ["csv", "txt", "tsv"].includes(extension ?? "") ? "csv" : ["xlsx", "xls"].includes(extension ?? "") ? "xlsx" : null;
      if (!fileType) throw new Error("Formato no soportado");

      const title = documentTitle.trim() || selectedFile.name;
      const { data: document, error: docError } = await supabase
        .from("supplier_documents")
        .insert({
          supplier_id: selectedSupplier.id,
          title,
          file_name: selectedFile.name,
          file_type: fileType,
          notes: documentNotes.trim() || null,
        })
        .select("id")
        .single();
      if (docError) throw docError;

      let catalogId = selectedCatalogId === "new" ? null : selectedCatalogId;
      if (!catalogId) {
        const { data: createdCatalog, error: catalogError } = await supabase
          .from("supplier_catalogs")
          .insert({
            supplier_id: selectedSupplier.id,
            title,
            notes: documentNotes.trim() || null,
          })
          .select("id")
          .single();
        if (catalogError) throw catalogError;
        catalogId = createdCatalog.id;
      }

      const { data: version, error: versionError } = await supabase
        .from("supplier_catalog_versions")
        .insert({
          supplier_id: selectedSupplier.id,
          catalog_id: catalogId,
          supplier_document_id: document.id,
          title,
        })
        .select("id")
        .single();
      if (versionError) throw versionError;

      if (fileType === "pdf") {
        return { total: 0, parsed: false, versionId: version.id };
      }

      const { headers, rows } = await parseImportFile(selectedFile);
      const validRows = rows.filter((row) => !isRowEmpty(row));
      if (validRows.length === 0) {
        throw new Error("Archivo sin filas válidas");
      }

      const lowerMap = headers.reduce<Record<string, string>>((acc, h) => {
        acc[h.toLowerCase()] = h;
        return acc;
      }, {});

      const findHeader = (...candidates: string[]) => candidates.find((c) => lowerMap[c]) ? lowerMap[candidates.find((c) => lowerMap[c])!] : "";
      const codeHeader = findHeader("codigo", "código", "cod", "sku", "item", "supplier_code");
      const descriptionHeader = findHeader("descripcion", "descripción", "description", "detalle", "producto", "articulo", "artículo");
      const costHeader = findHeader("costo", "cost", "precio", "price", "importe");
      const currencyHeader = findHeader("moneda", "currency", "curr");

      if (!descriptionHeader || !costHeader) {
        throw new Error("No se detectaron columnas de descripción/costo en el archivo");
      }

      const { data: aliases, error: aliasesError } = await supabase
        .from("item_aliases")
        .select("item_id, alias, is_supplier_code");
      if (aliasesError) throw aliasesError;

      const lines = validRows
        .map((row, rowIndex) => {
          const supplierCode = codeHeader ? (row[codeHeader] ?? "").trim() : "";
          const rawDescription = (row[descriptionHeader] ?? "").trim();
          const cost = parsePrice(row[costHeader] ?? "0");
          const currency = currencyHeader ? (row[currencyHeader] ?? "ARS").trim().toUpperCase() : "ARS";
          const match = matchImportLine({ supplierCode, rawDescription, aliases: aliases ?? [] });
          return {
            supplier_catalog_version_id: version.id,
            supplier_code: supplierCode || null,
            raw_description: rawDescription,
            normalized_description: rawDescription.toLowerCase(),
            cost,
            currency: currency || "ARS",
            row_index: rowIndex + 1,
            matched_item_id: match.itemId,
            match_status: (match.itemId ? "MATCHED" : "PENDING") as "MATCHED" | "PENDING" | "NEW",
          };
        })
        .filter((line) => line.raw_description && line.cost > 0);

      if (lines.length === 0) {
        throw new Error("No se encontraron filas válidas para importar");
      }

      for (let i = 0; i < lines.length; i += 500) {
        const batch = lines.slice(i, i + 500);
        const { error } = await supabase.from("supplier_catalog_lines").insert(batch);
        if (error) throw error;
      }

      return { total: lines.length, parsed: true, versionId: version.id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["supplier-catalogs", selectedSupplier?.id] });
      qc.invalidateQueries({ queryKey: ["supplier-catalog-versions", selectedSupplier?.id] });
      qc.invalidateQueries({ queryKey: ["supplier-catalog-lines"] });
      setDocumentTitle("");
      setDocumentNotes("");
      setSelectedCatalogId("new");
      setSelectedFile(null);
      setActiveVersionId(result.versionId);
      setOrderItems({});
      setLineQuantities({});
      toast({
        title: "Documento cargado",
        description: result.parsed ? `Importados ${result.total} ítems` : "PDF guardado (sin parsear)",
      });
    },
    onError: (e: Error) => {
      setSelectedFile(null);
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
    setSelectedCatalogId("new");
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
    const versionDate = activeVersion ? formatDate(activeVersion.imported_at) : "Sin versión";
    const catalogName = activeVersion ? catalogTitleById.get(activeVersion.catalog_id) ?? activeVersion.title ?? "Listado" : "Sin listado";
    const rows = orderLines.map((line) => `${line.supplier_code ?? "S/COD"} - ${line.raw_description} x ${line.quantity}`);
    return [
      `Proveedor: ${selectedSupplier.name}`,
      `Listado/Versión usada: ${catalogName} (${versionDate})`,
      "Ítems:",
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
            <p className="text-muted-foreground">Gestión de proveedores y catálogos</p>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo proveedor</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <TableCell>{s.contact_name ?? "—"}</TableCell>
                  <TableCell>{s.email ?? "—"}</TableCell>
                  <TableCell>{s.whatsapp ? `+${normalizeWhatsappNumber(s.whatsapp)}` : "—"}</TableCell>
                  <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openCatalog(s)} title="Catálogos"><Upload className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="max-w-7xl">
          <DialogHeader><DialogTitle>Catálogos del proveedor: {selectedSupplier?.name}</DialogTitle></DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="text-base">Subir archivo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Título</Label>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
              <CardContent className="max-h-[280px] space-y-3 overflow-auto">
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
                          }}
                          className={`w-full rounded border p-2 text-left text-sm ${activeVersionId === version.id ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <p className="font-medium">{version.title ?? catalog.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(version.imported_at)} · {version.file_name} · {version.file_type.toUpperCase()} · {version.line_count} líneas</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">Buscar en catálogos</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {activeVersion ? `Versión activa: ${activeVersion.title ?? catalogTitleById.get(activeVersion.catalog_id) ?? "Listado"} (${formatDate(activeVersion.imported_at)})` : "Seleccioná una versión en el Historial"}
                </p>
                <Input placeholder="Buscar por descripción o código" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} disabled={!activeVersionId} />
              </CardHeader>
              <CardContent>
                <div className="max-h-[340px] overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="w-[110px]">Cantidad</TableHead>
                        <TableHead className="w-[120px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!activeVersionId ? (
                        <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Seleccioná una versión para ver líneas</TableCell></TableRow>
                      ) : isCatalogLoading ? (
                        <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                      ) : activeCatalogLines.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
                      ) : activeCatalogLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-mono text-xs">{line.supplier_code ?? "—"}</TableCell>
                          <TableCell className="text-sm">{line.raw_description}</TableCell>
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

            <Card>
              <CardHeader><CardTitle className="text-base">Pedido actual</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-[220px] space-y-2 overflow-auto">
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
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
