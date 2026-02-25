import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Settings2 } from "lucide-react";

type MovementType = "IN" | "OUT" | "ADJUSTMENT";

interface StockRow {
  item_id: string;
  item_name: string;
  item_sku: string;
  item_unit: string;
  total: number;
}

interface Movement {
  id: string;
  item_id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  items?: { name: string; sku: string } | null;
}

export default function StockPage() {
  const [tab, setTab] = useState("current");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", type: "IN" as MovementType, quantity: "", reference: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  // Items for select
  const { data: items = [] } = useQuery({
    queryKey: ["items-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, name, sku, unit").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Current stock calculated from movements
  const { data: stockRows = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-current", search],
    queryFn: async () => {
      const { data: movements, error } = await supabase.from("stock_movements").select("item_id, type, quantity, items(name, sku, unit)");
      if (error) throw error;

      const map = new Map<string, StockRow>();
      for (const m of movements as any[]) {
        if (!map.has(m.item_id)) {
          map.set(m.item_id, {
            item_id: m.item_id,
            item_name: m.items?.name ?? "",
            item_sku: m.items?.sku ?? "",
            item_unit: m.items?.unit ?? "",
            total: 0,
          });
        }
        const row = map.get(m.item_id)!;
        if (m.type === "IN") row.total += Number(m.quantity);
        else if (m.type === "OUT") row.total -= Number(m.quantity);
        else row.total += Number(m.quantity); // ADJUSTMENT can be +/-
      }

      let rows = Array.from(map.values());
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r) => r.item_name.toLowerCase().includes(s) || r.item_sku.toLowerCase().includes(s));
      }
      return rows.sort((a, b) => a.item_name.localeCompare(b.item_name));
    },
  });

  // Movements history
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, item_id, type, quantity, reference, created_at, created_by, items(name, sku)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = Array.from(new Set((data ?? []).map((m) => m.created_by).filter(Boolean))) as string[];
      const namesByUserId = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        for (const p of profiles ?? []) {
          namesByUserId.set(p.user_id, p.full_name || p.user_id.slice(0, 8));
        }
      }

      return ((data ?? []) as Movement[]).map((m) => ({
        ...m,
        created_by_name: m.created_by ? (namesByUserId.get(m.created_by) ?? m.created_by.slice(0, 8)) : "Sistema",
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.item_id) throw new Error("Seleccioná un ítem");

      const qty = parseFloat(form.quantity);
      if (isNaN(qty) || !Number.isFinite(qty) || qty === 0) throw new Error("Cantidad inválida");
      const { error } = await supabase.from("stock_movements").insert({
        item_id: form.item_id,
        type: form.type,
        quantity: qty,
        reference: form.reference || null,
        created_by: user?.id ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      setDialogOpen(false);
      toast({ title: "Movimiento registrado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const typeIcon = (t: MovementType) => {
    if (t === "IN") return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
    if (t === "OUT") return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
    return <Settings2 className="h-4 w-4 text-yellow-500" />;
  };

  const typeLabel: Record<MovementType, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste" };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
            <p className="text-muted-foreground">Movimientos y stock actual</p>
          </div>
          <Button onClick={() => { setForm({ item_id: "", type: "IN", quantity: "", reference: "" }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="current">Stock actual</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar ítem..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStock ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : stockRows.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sin movimientos de stock</TableCell></TableRow>
                  ) : stockRows.map((r) => (
                    <TableRow key={r.item_id}>
                      <TableCell className="font-mono text-xs">{r.item_sku}</TableCell>
                      <TableCell className="font-medium">{r.item_name}</TableCell>
                      <TableCell>{r.item_unit}</TableCell>
                      <TableCell className="text-right font-bold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="movements">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ítem</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMovements ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : movements.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin movimientos</TableCell></TableRow>
                  ) : movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleString("es-AR")}</TableCell>
                      <TableCell className="text-sm">{m.created_by_name ?? "Sistema"}</TableCell>
                      <TableCell><div className="flex items-center gap-2">{typeIcon(m.type)}<span className="text-sm">{typeLabel[m.type]}</span></div></TableCell>
                      <TableCell className="font-medium">{(m.items as any)?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.reference ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Ítem *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar ítem" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.sku} — {i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as MovementType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Salida</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2"><Label>Referencia</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                        <DialogFooter><Button type="submit" disabled={saveMutation.isPending || !form.item_id}>{saveMutation.isPending ? "Guardando..." : "Registrar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
