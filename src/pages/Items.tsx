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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Tags } from "lucide-react";

interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  unit: string;
  category: string | null;
  is_active: boolean;
}

interface ItemAlias {
  id: string;
  item_id: string;
  alias: string;
  is_supplier_code: boolean;
}

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", unit: "un", category: "" });
  const [newAlias, setNewAlias] = useState("");
  const [isSupplierCode, setIsSupplierCode] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items", search],
    queryFn: async () => {
      let q = supabase.from("items").select("*").order("created_at", { ascending: false });
      if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: aliases = [] } = useQuery({
    queryKey: ["item-aliases", selectedItem?.id],
    enabled: !!selectedItem,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_aliases")
        .select("*")
        .eq("item_id", selectedItem!.id)
        .order("created_at");
      if (error) throw error;
      return data as ItemAlias[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingItem) {
        const { error } = await supabase
          .from("items")
          .update({ name: form.name, brand: form.brand || null, unit: form.unit, category: form.category || null })
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("items")
          .insert({ name: form.name, brand: form.brand || null, unit: form.unit, category: form.category || null, sku: "" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-count"] });
      setDialogOpen(false);
      toast({ title: editingItem ? "Ítem actualizado" : "Ítem creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-count"] });
      toast({ title: "Ítem eliminado" });
    },
  });

  const addAliasMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("item_aliases")
        .insert({ item_id: selectedItem!.id, alias: newAlias, is_supplier_code: isSupplierCode });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-aliases"] });
      setNewAlias("");
      setIsSupplierCode(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("item_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item-aliases"] }),
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm({ name: "", brand: "", unit: "un", category: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setForm({ name: item.name, brand: item.brand ?? "", unit: item.unit, category: item.category ?? "" });
    setDialogOpen(true);
  };

  const openAliases = (item: Item) => {
    setSelectedItem(item);
    setAliasDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ítems</h1>
            <p className="text-muted-foreground">Catálogo maestro de productos</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo ítem
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU o marca..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron ítems
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand ?? "—"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.category ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openAliases(item)}>
                          <Tags className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unidad *</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Aliases Dialog */}
      <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alias de {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nuevo alias..."
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                className="flex-1"
              />
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={isSupplierCode}
                  onChange={(e) => setIsSupplierCode(e.target.checked)}
                  className="rounded"
                />
                Cód. proveedor
              </label>
              <Button
                size="sm"
                onClick={() => addAliasMutation.mutate()}
                disabled={!newAlias.trim()}
              >
                Agregar
              </Button>
            </div>
            <div className="space-y-1">
              {aliases.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin alias</p>
              )}
              {aliases.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{a.alias}</span>
                    {a.is_supplier_code && (
                      <Badge variant="outline" className="text-xs">código</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteAliasMutation.mutate(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
