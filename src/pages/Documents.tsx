import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, FileDown, Send, Copy, Ban } from "lucide-react";

type DocType = "PRESUPUESTO" | "REMITO";
type DocStatus = "DRAFT" | "ISSUED" | "CANCELLED";

interface LineDraft {
  item_id: string | null;
  sku_snapshot: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

interface DocRow {
  id: string;
  doc_type: DocType;
  status: DocStatus;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_name: string | null;
  total: number;
  notes: string | null;
}

interface DocLineRow {
  id: string;
  line_order: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku_snapshot: string | null;
}

const DOC_LABEL: Record<DocType, string> = { PRESUPUESTO: "Presupuesto", REMITO: "Remito" };
const STATUS_LABEL: Record<DocStatus, string> = { DRAFT: "Borrador", ISSUED: "Emitido", CANCELLED: "Anulado" };
const STATUS_VARIANT: Record<DocStatus, "secondary" | "default" | "destructive"> = {
  DRAFT: "secondary",
  ISSUED: "default",
  CANCELLED: "destructive",
};

const formatNumber = (n: number | null, pointOfSale: number) => {
  if (n === null) return "BORRADOR";
  return `${String(pointOfSale).padStart(4, "0")}-${String(n).padStart(8, "0")}`;
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [form, setForm] = useState({
    doc_type: "PRESUPUESTO" as DocType,
    point_of_sale: 1,
    customer_id: "",
    customer_name: "",
    customer_tax_condition: "",
    customer_tax_id: "",
    price_list_id: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([
    { item_id: null, sku_snapshot: "", description: "", unit: "un", quantity: 1, unit_price: 0 },
  ]);

  const { data: customers = [] } = useQuery({
    queryKey: ["documents-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, cuit").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["documents-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, sku, name, unit").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["documents-price-lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_lists").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ["documents-price-list-items", form.price_list_id],
    enabled: !!form.price_list_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("item_id, final_price")
        .eq("price_list_id", form.price_list_id)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const priceByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of priceListItems) map.set(r.item_id, Number(r.final_price) || 0);
    return map;
  }, [priceListItems]);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", search, typeFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_name, total, notes")
        .order("created_at", { ascending: false });
      if (typeFilter !== "ALL") q = q.eq("doc_type", typeFilter);
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      if (search.trim()) {
        const n = Number.parseInt(search.trim(), 10);
        const clauses = [`customer_name.ilike.%${search.trim()}%`];
        if (Number.isFinite(n)) clauses.push(`document_number.eq.${n}`);
        q = q.or(clauses.join(","));
      }
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const { data: selectedLines = [] } = useQuery({
    queryKey: ["document-lines", selectedDocId],
    enabled: !!selectedDocId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_lines")
        .select("id, line_order, description, quantity, unit_price, line_total, sku_snapshot")
        .eq("document_id", selectedDocId!)
        .order("line_order");
      if (error) throw error;
      return (data ?? []) as DocLineRow[];
    },
  });

  const totalDraft = useMemo(() => lines.reduce((acc, l) => acc + l.quantity * l.unit_price, 0), [lines]);

  const upsertDraftMutation = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((l) => l.description.trim() && l.quantity > 0);
      if (valid.length === 0) throw new Error("Agregá al menos una línea válida");

      const customerName =
        form.customer_id
          ? customers.find((c) => c.id === form.customer_id)?.name ?? form.customer_name
          : form.customer_name || "Cliente ocasional";

      const { data: doc, error: dErr } = await supabase
        .from("documents")
        .insert({
          doc_type: form.doc_type,
          status: "DRAFT",
          point_of_sale: form.point_of_sale,
          customer_id: form.customer_id || null,
          customer_name: customerName || null,
          customer_tax_condition: form.customer_tax_condition || null,
          customer_tax_id: form.customer_tax_id || null,
          price_list_id: form.price_list_id || null,
          notes: form.notes || null,
          subtotal: totalDraft,
          total: totalDraft,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (dErr) throw dErr;

      const payload = valid.map((l, i) => ({
        document_id: doc.id,
        line_order: i + 1,
        item_id: l.item_id,
        sku_snapshot: l.sku_snapshot || null,
        description: l.description,
        unit: l.unit || null,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.quantity * l.unit_price,
        created_by: user?.id,
      }));
      const { error: lErr } = await supabase.from("document_lines").insert(payload);
      if (lErr) throw lErr;

      await supabase.from("document_events").insert({
        document_id: doc.id,
        event_type: "CREATED",
        payload: { source: "ui" },
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      setDialogOpen(false);
      setLines([{ item_id: null, sku_snapshot: "", description: "", unit: "un", quantity: 1, unit_price: 0 }]);
      toast({ title: "Borrador guardado" });
    },
    onError: (e: unknown) => toast({
      title: "Error",
      description: e instanceof Error ? e.message : "No se pudo guardar",
      variant: "destructive",
    }),
  });

  const issueMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.rpc("issue_document", { p_document_id: documentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Documento emitido" });
    },
    onError: (e: unknown) => toast({
      title: "Error al emitir",
      description: e instanceof Error ? e.message : "Error desconocido",
      variant: "destructive",
    }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from("documents")
        .update({ status: "CANCELLED" })
        .eq("id", documentId)
        .eq("status", "ISSUED");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Documento anulado" });
    },
  });

  const cloneAsRemitoMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { data: src, error: sErr } = await supabase
        .from("documents")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (sErr) throw sErr;
      const { data: srcLines, error: lErr } = await supabase
        .from("document_lines")
        .select("*")
        .eq("document_id", sourceId)
        .order("line_order");
      if (lErr) throw lErr;

      const { data: newDoc, error: nErr } = await supabase
        .from("documents")
        .insert({
          doc_type: "REMITO",
          status: "DRAFT",
          point_of_sale: src.point_of_sale,
          customer_id: src.customer_id,
          customer_name: src.customer_name,
          customer_tax_condition: src.customer_tax_condition,
          customer_tax_id: src.customer_tax_id,
          price_list_id: src.price_list_id,
          notes: src.notes,
          subtotal: src.subtotal,
          total: src.total,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (nErr) throw nErr;

      const linesPayload = (srcLines ?? []).map((l) => ({
        document_id: newDoc.id,
        line_order: l.line_order,
        item_id: l.item_id,
        sku_snapshot: l.sku_snapshot,
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_pct: l.discount_pct,
        line_total: l.line_total,
        created_by: user?.id,
      }));
      const { error: insErr } = await supabase.from("document_lines").insert(linesPayload);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Remito borrador creado" });
    },
  });

  const onPickItem = (idx: number, itemId: string) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    const next = [...lines];
    next[idx] = {
      ...next[idx],
      item_id: itemId,
      sku_snapshot: it.sku,
      description: it.name,
      unit: it.unit || "un",
      unit_price: priceByItem.get(itemId) ?? next[idx].unit_price,
    };
    setLines(next);
  };

  const printDocument = async (d: DocRow) => {
    const { data: linesData } = await supabase
      .from("document_lines")
      .select("line_order, description, quantity, unit_price, line_total")
      .eq("document_id", d.id)
      .order("line_order");

    const rows = (linesData ?? []).map((l) => `
      <tr>
        <td>${l.line_order}</td>
        <td>${l.description}</td>
        <td style="text-align:right">${Number(l.quantity).toLocaleString("es-AR")}</td>
        <td style="text-align:right">$${Number(l.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">$${Number(l.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${DOC_LABEL[d.doc_type]} ${formatNumber(d.document_number, d.point_of_sale)}</title>
      <style>
      body{font-family:Arial,sans-serif;padding:28px;max-width:900px;margin:0 auto}
      h1{margin:0 0 8px 0}
      .meta{color:#4b5563;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      th,td{border:1px solid #d1d5db;padding:8px;font-size:12px}
      th{background:#f3f4f6}
      .t{text-align:right;font-weight:bold;margin-top:14px}
      @media print{button{display:none}}
      </style></head><body>
      <h1>${DOC_LABEL[d.doc_type]} ${formatNumber(d.document_number, d.point_of_sale)}</h1>
      <p class="meta">Fecha: ${new Date(d.issue_date).toLocaleDateString("es-AR")} | Estado: ${STATUS_LABEL[d.status]}</p>
      <p class="meta">Cliente: ${d.customer_name ?? "Cliente ocasional"}</p>
      <table><thead><tr><th>#</th><th>Descripción</th><th>Cant.</th><th>P.Unit.</th><th>Importe</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="t">Total: $${Number(d.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
      </body></html>`);
    w.document.close();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground">Presupuestos y remitos rápidos</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo documento
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente o número..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full md:w-52">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocType | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="PRESUPUESTO">Presupuestos</SelectItem>
                <SelectItem value="REMITO">Remitos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-52">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocStatus | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="ISSUED">Emitido</SelectItem>
                <SelectItem value="CANCELLED">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[220px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : documents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin documentos</TableCell></TableRow>
              ) : documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{DOC_LABEL[d.doc_type]}</TableCell>
                  <TableCell className="font-mono">{formatNumber(d.document_number, d.point_of_sale)}</TableCell>
                  <TableCell className="font-medium">{d.customer_name ?? "Cliente ocasional"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge></TableCell>
                  <TableCell className="text-right font-mono">${Number(d.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{new Date(d.issue_date).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedDocId(d.id); setDetailOpen(true); }} title="Ver">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => printDocument(d)} title="Imprimir / PDF">
                        <FileDown className="h-4 w-4" />
                      </Button>
                      {d.status === "DRAFT" && (
                        <Button variant="ghost" size="icon" onClick={() => issueMutation.mutate(d.id)} title="Emitir">
                          <Send className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {d.doc_type === "PRESUPUESTO" && (
                        <Button variant="ghost" size="icon" onClick={() => cloneAsRemitoMutation.mutate(d.id)} title="Convertir a remito">
                          <Copy className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {d.status === "ISSUED" && (
                        <Button variant="ghost" size="icon" onClick={() => cancelMutation.mutate(d.id)} title="Anular">
                          <Ban className="h-4 w-4 text-destructive" />
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Nuevo documento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertDraftMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v as DocType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESUPUESTO">Presupuesto</SelectItem>
                    <SelectItem value="REMITO">Remito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Punto de venta</Label>
                <Input type="number" min={1} value={form.point_of_sale} onChange={(e) => setForm({ ...form, point_of_sale: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div className="space-y-2">
                <Label>Lista de precios</Label>
                <Select value={form.price_list_id || "__none__"} onValueChange={(v) => setForm({ ...form, price_list_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin lista</SelectItem>
                    {priceLists.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Cliente registrado</Label>
                <Select value={form.customer_id || "__none__"} onValueChange={(v) => setForm({ ...form, customer_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin seleccionar</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre cliente</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CUIT (opcional)</Label>
                <Input value={form.customer_tax_id} onChange={(e) => setForm({ ...form, customer_tax_id: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Líneas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, { item_id: null, sku_snapshot: "", description: "", unit: "un", quantity: 1, unit_price: 0 }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Línea
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <Select value={line.item_id ?? "__none__"} onValueChange={(v) => onPickItem(idx, v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Ítem" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Manual</SelectItem>
                          {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.sku} - {it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input className="col-span-4" placeholder="Descripción" value={line.description} onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setLines(next);
                    }} />
                    <Input className="col-span-1" type="number" step="any" value={line.quantity} onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                      setLines(next);
                    }} />
                    <Input className="col-span-2" type="number" step="any" value={line.unit_price} onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], unit_price: Number(e.target.value) || 0 };
                      setLines(next);
                    }} />
                    <div className="col-span-2 flex items-center justify-end text-sm font-mono">
                      ${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-right font-bold">Total: ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={upsertDraftMutation.isPending}>
                {upsertDraftMutation.isPending ? "Guardando..." : "Guardar borrador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Detalle del documento</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">P.Unit.</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedLines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.line_order}</TableCell>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-right">{Number(l.quantity).toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-right font-mono">${Number(l.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">${Number(l.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
