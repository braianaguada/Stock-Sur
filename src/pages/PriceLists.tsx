import { useState } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2 } from "lucide-react";

export default function PriceListsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linesDialogOpen, setLinesDialogOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", supplier_id: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ["price-lists", search],
    queryFn: async () => {
      let q = supabase.from("price_lists").select("*, suppliers(name), price_list_versions(id, version_date, notes)").order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["price-list-lines", selectedVersionId],
    enabled: !!selectedVersionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_lines")
        .select("*, items(name, sku)")
        .eq("version_id", selectedVersionId!)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("price_lists").insert({ name: form.name, supplier_id: form.supplier_id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-lists"] });
      setDialogOpen(false);
      toast({ title: "Lista creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-lists"] });
      toast({ title: "Lista eliminada" });
    },
  });

  const openLines = (versionId: string) => {
    setSelectedVersionId(versionId);
    setLinesDialogOpen(true);
  };

  const matchBadge = (status: string) => {
    if (status === "MATCHED") return <Badge variant="default">Matched</Badge>;
    if (status === "PENDING") return <Badge variant="secondary">Pendiente</Badge>;
    return <Badge variant="outline">Nuevo</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listas de precios</h1>
            <p className="text-muted-foreground">Gestión de listas de precios por proveedor</p>
          </div>
          <Button onClick={() => { setForm({ name: "", supplier_id: "" }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nueva lista
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lista..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Versiones</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : priceLists.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay listas de precios</TableCell></TableRow>
              ) : priceLists.map((pl) => (
                <TableRow key={pl.id}>
                  <TableCell className="font-medium">{pl.name}</TableCell>
                  <TableCell>{pl.suppliers?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(pl.price_list_versions ?? []).map((v: any) => (
                        <Button key={v.id} variant="outline" size="sm" className="h-7 text-xs" onClick={() => openLines(v.id)}>
                          <Eye className="mr-1 h-3 w-3" /> {v.version_date}
                        </Button>
                      ))}
                      {(pl.price_list_versions ?? []).length === 0 && <span className="text-sm text-muted-foreground">Sin versiones</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(pl.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva lista de precios</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={saveMutation.isPending || !form.supplier_id}>{saveMutation.isPending ? "Guardando..." : "Crear"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lines Dialog */}
      <Dialog open={linesDialogOpen} onOpenChange={setLinesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Líneas de la versión</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cód. Proveedor</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Ítem</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin líneas</TableCell></TableRow>
              ) : lines.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.supplier_code ?? "—"}</TableCell>
                  <TableCell className="text-sm">{l.raw_description}</TableCell>
                  <TableCell className="text-right font-mono">{Number(l.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{l.currency}</TableCell>
                  <TableCell className="text-sm">{l.items?.name ?? "—"}</TableCell>
                  <TableCell>{matchBadge(l.match_status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
