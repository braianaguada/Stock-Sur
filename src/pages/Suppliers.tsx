import { useMemo, useState } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Upload, MessageCircle, Copy, Link as LinkIcon, ChevronDown } from "lucide-react";
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

interface CatalogLine {
  id: string;
  supplier_code: string | null;
  raw_description: string;
  cost: number;
  currency: string;
}

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [form, setForm] = useState({ name: "", contact_name: "", email: "", whatsapp: "", notes: "" });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [documentTitle, setDocumentTitle] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLines, setSelectedLines] = useState<Record<string, number>>({});

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

  const { data: supplierDocuments = [], isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["supplier-documents", selectedSupplier?.id],
    enabled: !!selectedSupplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_documents")
        .select("*, supplier_catalog_versions(id, imported_at)")
        .eq("supplier_id", selectedSupplier!.id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: catalogLines = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ["supplier-catalog-lines", selectedSupplier?.id, catalogSearch],
    enabled: !!selectedSupplier,
    queryFn: async () => {
      const { data: versionsData, error: versionError } = await supabase
        .from("supplier_catalog_versions")
        .select("id, supplier_documents!inner(supplier_id)")
        .eq("supplier_documents.supplier_id", selectedSupplier!.id);
      if (versionError) throw versionError;

      const versionIds = (versionsData ?? []).map((v: any) => v.id);
      if (versionIds.length === 0) return [];

      let query = supabase
        .from("supplier_catalog_lines")
        .select("id, supplier_code, raw_description, cost, currency")
        .in("supplier_catalog_version_id", versionIds)
        .order("created_at", { ascending: false })
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

      if (fileType === "pdf") {
        return { total: 0, parsed: false };
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

      if (!descriptionHeader || !costHeader) {
        throw new Error("No se detectaron columnas de descripción/costo en el archivo");
      }

      const { data: version, error: versionError } = await supabase
        .from("supplier_catalog_versions")
        .insert({ supplier_document_id: document.id, note: "Importación automática" })
        .select("id")
        .single();
      if (versionError) throw versionError;

      const { data: aliases, error: aliasesError } = await supabase
        .from("item_aliases")
        .select("item_id, alias, is_supplier_code");
      if (aliasesError) throw aliasesError;

      const lines = validRows
        .map((row) => {
          const supplierCode = codeHeader ? (row[codeHeader] ?? "").trim() : "";
          const rawDescription = (row[descriptionHeader] ?? "").trim();
          const cost = parsePrice(row[costHeader] ?? "0");
          const match = matchImportLine({ supplierCode, rawDescription, aliases: aliases ?? [] });
          return {
            supplier_catalog_version_id: version.id,
            supplier_code: supplierCode || null,
            raw_description: rawDescription,
            cost,
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

      return { total: lines.length, parsed: true };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["supplier-documents", selectedSupplier?.id] });
      qc.invalidateQueries({ queryKey: ["supplier-catalog-lines", selectedSupplier?.id] });
      setDocumentTitle("");
      setDocumentNotes("");
      setSelectedFile(null);
      toast({
        title: "Documento cargado",
        description: result.parsed ? `Se importaron ${result.total} líneas` : "PDF guardado (sin parsear)",
      });
    },
    onError: (e: any) => {
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
    setSelectedLines({});
    setCatalogDialogOpen(true);
  };

  const orderLines = useMemo(() => {
    return catalogLines
      .filter((line) => Boolean(selectedLines[line.id]))
      .map((line) => ({ ...line, quantity: selectedLines[line.id] }));
  }, [catalogLines, selectedLines]);

  const orderMessage = useMemo(() => {
    if (orderLines.length === 0) return "";
    const rows = orderLines.map((line) => `- (${line.quantity}) ${line.raw_description} (${line.supplier_code ?? "s/cod"}) $ ${Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`);
    return `Hola! Te hago el pedido:\n${rows.join("\n")}\nTotal items: ${orderLines.length}\nGracias!`;
  }, [orderLines]);

  const waLink = buildWhatsAppLink(selectedSupplier?.whatsapp, orderMessage);

  const updateLineSelection = (lineId: string, checked: boolean) => {
    setSelectedLines((prev) => {
      if (!checked) {
        const { [lineId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [lineId]: prev[lineId] && prev[lineId] > 0 ? prev[lineId] : 1 };
    });
  };

  const updateQuantity = (lineId: string, value: string) => {
    const qty = Number(value);
    if (!Number.isFinite(qty)) return;
    setSelectedLines((prev) => ({ ...prev, [lineId]: Math.max(1, qty) }));
  };

  const copyOrderMessage = async () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacío", description: "Seleccioná al menos un producto", variant: "destructive" });
      return;
    }

    await navigator.clipboard.writeText(orderMessage);
    toast({ title: "Mensaje copiado" });
  };

  const openWhatsApp = () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacío", description: "Seleccioná al menos un producto", variant: "destructive" });
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron proveedores</TableCell></TableRow>
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
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Catálogos del proveedor: {selectedSupplier?.name}</DialogTitle></DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Subir archivo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} placeholder="Ej: Lista Febrero 2026" />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={documentNotes} onChange={(e) => setDocumentNotes(e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label>Archivo (xlsx/csv/pdf)</Label>
                  <Input
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf"
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
              <CardContent className="space-y-2 max-h-[280px] overflow-auto">
                {isDocumentsLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : supplierDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin archivos cargados</p>
                ) : supplierDocuments.map((doc) => (
                  <div key={doc.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-muted-foreground">{doc.file_name} · {doc.file_type.toUpperCase()}</p>
                    <p className="text-muted-foreground">Versiones: {(doc.supplier_catalog_versions ?? []).length}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">Buscar en catálogos</CardTitle>
                <Input placeholder="Buscar por descripción o código" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
              </CardHeader>
              <CardContent>
                <div className="rounded border max-h-[340px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="w-[110px]">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isCatalogLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
                      ) : catalogLines.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin resultados</TableCell></TableRow>
                      ) : catalogLines.map((line) => {
                        const checked = Boolean(selectedLines[line.id]);
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <Checkbox checked={checked} onCheckedChange={(v) => updateLineSelection(line.id, Boolean(v))} />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{line.supplier_code ?? "—"}</TableCell>
                            <TableCell className="text-sm">{line.raw_description}</TableCell>
                            <TableCell className="text-right font-mono">{Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                disabled={!checked}
                                value={checked ? selectedLines[line.id] : 1}
                                onChange={(e) => updateQuantity(line.id, e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pedido actual</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-[220px] overflow-auto space-y-2">
                  {orderLines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin productos seleccionados</p>
                  ) : orderLines.map((line) => (
                    <div key={line.id} className="rounded border p-2 text-sm">
                      <p className="font-medium">{line.raw_description}</p>
                      <p className="text-muted-foreground">x{line.quantity} · {line.supplier_code ?? "s/cod"} · ${Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>

                {!selectedSupplier?.whatsapp && (
                  <p className="text-sm text-amber-600">Este proveedor no tiene WhatsApp configurado.</p>
                )}

                <div className="grid gap-2">
                  <Button variant="outline" onClick={copyOrderMessage}><Copy className="mr-2 h-4 w-4" /> Copiar mensaje</Button>
                  <Button onClick={openWhatsApp}><MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp</Button>
                  <Button variant="ghost" asChild disabled={!selectedSupplier?.whatsapp}>
                    <a href={buildWhatsAppLink(selectedSupplier?.whatsapp) ?? "#"} target="_blank" rel="noreferrer">
                      <LinkIcon className="mr-2 h-4 w-4" /> Ver link wa.me
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
