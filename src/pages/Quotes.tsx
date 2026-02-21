import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, Eye, Trash2, FileDown, X } from "lucide-react";

interface QuoteLine {
  description: string;
  quantity: number;
  unit_price: number;
  item_id: string | null;
}

const STATUS_LABELS: Record<string, string> = { DRAFT: "Borrador", SENT: "Enviado", ACCEPTED: "Aceptado", REJECTED: "Rechazado" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary", SENT: "default", ACCEPTED: "default", REJECTED: "destructive",
};

export default function QuotesPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_id: "", customer_name: "", notes: "" });
  const [lines, setLines] = useState<QuoteLine[]>([{ description: "", quantity: 1, unit_price: 0, item_id: null }]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes", search],
    queryFn: async () => {
      let q = supabase.from("quotes").select("*, customers(name)").order("created_at", { ascending: false });
      if (search) q = q.or(`customer_name.ilike.%${search}%,quote_number.eq.${parseInt(search) || 0}`);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: quoteLines = [] } = useQuery({
    queryKey: ["quote-lines", selectedQuoteId],
    enabled: !!selectedQuoteId,
    queryFn: async () => {
      const { data, error } = await supabase.from("quote_lines").select("*, items(name, sku)").eq("quote_id", selectedQuoteId!);
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.description.trim());
      if (validLines.length === 0) throw new Error("Agregá al menos una línea");

      const total = validLines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
      const customerName = form.customer_id
        ? customers.find((c) => c.id === form.customer_id)?.name ?? form.customer_name
        : form.customer_name || "Cliente ocasional";

      const { data: quote, error } = await supabase
        .from("quotes")
        .insert({
          customer_id: form.customer_id || null,
          customer_name: customerName,
          notes: form.notes || null,
          total,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const lineInserts = validLines.map((l) => ({
        quote_id: quote.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        subtotal: l.quantity * l.unit_price,
        item_id: l.item_id,
      }));
      const { error: lErr } = await supabase.from("quote_lines").insert(lineInserts);
      if (lErr) throw lErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setDialogOpen(false);
      toast({ title: "Presupuesto creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("quote_lines").delete().eq("quote_id", id);
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Presupuesto eliminado" });
    },
  });

  const addLine = () => setLines([...lines, { description: "", quantity: 1, unit_price: 0, item_id: null }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof QuoteLine, value: any) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    setLines(updated);
  };

  const exportPDF = (quote: any) => {
    // Simple text-based export using a printable window
    const selectedQuote = quote;
    const w = window.open("", "_blank");
    if (!w) return;
    
    // Fetch lines for this quote
    supabase.from("quote_lines").select("*").eq("quote_id", selectedQuote.id).then(({ data: ql }) => {
      const linesHtml = (ql ?? []).map((l: any) =>
        `<tr><td>${l.description}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">$${Number(l.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td><td style="text-align:right">$${Number(l.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td></tr>`
      ).join("");
      
      w.document.write(`<!DOCTYPE html><html><head><title>Presupuesto #${selectedQuote.quote_number}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto}
        h1{color:#1e293b;border-bottom:3px solid #d97706;padding-bottom:10px}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}
        th{background:#f1f5f9}
        .total{font-size:1.2em;font-weight:bold;text-align:right;margin-top:20px}
        .meta{color:#64748b;margin:5px 0}
        @media print{button{display:none}}</style></head><body>
        <h1>Stock Sur — Presupuesto #${selectedQuote.quote_number}</h1>
        <p class="meta">Cliente: <strong>${selectedQuote.customer_name ?? "—"}</strong></p>
        <p class="meta">Fecha: ${new Date(selectedQuote.created_at).toLocaleDateString("es-AR")}</p>
        ${selectedQuote.notes ? `<p class="meta">Notas: ${selectedQuote.notes}</p>` : ""}
        <table><thead><tr><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">P. Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${linesHtml}</tbody></table>
        <p class="total">Total: $${Number(selectedQuote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
        <button onclick="window.print()" style="margin-top:20px;padding:8px 16px;cursor:pointer">Imprimir / Guardar PDF</button>
        </body></html>`);
      w.document.close();
    });
  };

  const openCreate = () => {
    setForm({ customer_id: "", customer_name: "", notes: "" });
    setLines([{ description: "", quantity: 1, unit_price: 0, item_id: null }]);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
            <p className="text-muted-foreground">Crear y exportar presupuestos</p>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente o número..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : quotes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay presupuestos</TableCell></TableRow>
              ) : quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono">{q.quote_number}</TableCell>
                  <TableCell className="font-medium">{q.customer_name ?? q.customers?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANTS[q.status] ?? "secondary"}>{STATUS_LABELS[q.status] ?? q.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">${Number(q.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(q.created_at).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedQuoteId(q.id); setDetailDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => exportPDF(q)}><FileDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Nuevo presupuesto</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente registrado</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin seleccionar</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre cliente</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="O escribí un nombre" />
              </div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Líneas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Línea</Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input className="flex-1" placeholder="Descripción" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
                    <Input className="w-20" type="number" step="any" placeholder="Cant." value={line.quantity} onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} />
                    <Input className="w-28" type="number" step="any" placeholder="Precio" value={line.unit_price} onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} />
                    <span className="text-sm text-muted-foreground w-24 text-right pt-2">${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    {lines.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeLine(i)}><X className="h-3 w-3" /></Button>}
                  </div>
                ))}
              </div>
              <p className="text-right font-bold">Total: ${lines.reduce((s, l) => s + l.quantity * l.unit_price, 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>

            <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Crear presupuesto"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle del presupuesto</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">P. Unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quoteLines.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right font-mono">${Number(l.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">${Number(l.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
