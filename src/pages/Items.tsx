import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", unit: "un", category: "", isActive: true });
  const [newAlias, setNewAlias] = useState("");
  const [isSupplierCode, setIsSupplierCode] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items", search, categoryFilter],
    queryFn: async () => {
      const searchTerm = search.trim();
      let matchingItemIdsFromAlias: string[] = [];

      if (searchTerm) {
        const { data: aliasMatches, error: aliasError } = await supabase
          .from("item_aliases")
          .select("item_id")
          .ilike("alias", `%${searchTerm}%`)
          .limit(200);
        if (aliasError) throw aliasError;
        matchingItemIdsFromAlias = [...new Set((aliasMatches ?? []).map((a) => a.item_id))];
      }

      let q = supabase.from("items").select("*").order("created_at", { ascending: false });

      if (searchTerm) {
        const searchFilters = [
          `name.ilike.%${searchTerm}%`,
          `sku.ilike.%${searchTerm}%`,
        ];

        if (matchingItemIdsFromAlias.length > 0) {
          searchFilters.push(`id.in.(${matchingItemIdsFromAlias.join(",")})`);
        }

        q = q.or(searchFilters.join(","));
      }

      if (categoryFilter !== "all") {
        q = q.eq("category", categoryFilter);
      }

      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["items-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("category")
        .not("category", "is", null);
      if (error) throw error;

      return Array.from(new Set((data ?? []).map((item) => item.category).filter(Boolean))) as string[];
    },
  });

  const { data: aliases = [] } = useQuery({
    queryKey: ["item-aliases", editingItem?.id],
    enabled: !!editingItem,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_aliases")
        .select("*")
        .eq("item_id", editingItem!.id)
        .order("created_at");
      if (error) throw error;
      return data as ItemAlias[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const unit = form.unit.trim();

      if (!name || !unit) {
        throw new Error("Nombre y unidad son obligatorios");
      }

      if (editingItem) {
        const { error } = await supabase
          .from("items")
          .update({
            name,
            brand: form.brand || null,
            unit,
            category: form.category || null,
            is_active: form.isActive,
          })
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("items")
          .insert({
            name,
            brand: form.brand || null,
            unit,
            category: form.category || null,
            is_active: form.isActive,
            sku: "",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-categories"] });
      setDialogOpen(false);
      setEditingItem(null);
      setNewAlias("");
      setIsSupplierCode(false);
      toast({ title: editingItem ? "Ítem actualizado" : "Ítem creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-categories"] });
      toast({ title: "Ítem eliminado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addAliasMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error("Seleccioná un ítem antes de agregar alias");

      const { error } = await supabase
        .from("item_aliases")
        .insert({ item_id: editingItem.id, alias: newAlias.trim(), is_supplier_code: isSupplierCode });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-aliases", editingItem?.id] });
      qc.invalidateQueries({ queryKey: ["items"] });
      setNewAlias("");
      setIsSupplierCode(false);
    },
    onError: (e: Error) => {
      const lowerMessage = e.message.toLowerCase();
      const duplicateAlias = lowerMessage.includes("duplicate") || lowerMessage.includes("unique");

      toast({
        title: duplicateAlias ? "Alias duplicado" : "Error",
        description: duplicateAlias ? "Ese alias ya existe. Probá con otro código." : e.message,
        variant: "destructive",
      });
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("item_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-aliases", editingItem?.id] });
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingItem(null);
    setNewAlias("");
    setIsSupplierCode(false);
    setForm({ name: "", brand: "", unit: "un", category: "", isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setNewAlias("");
    setIsSupplierCode(false);
    setForm({
      name: item.name,
      brand: item.brand ?? "",
      unit: item.unit,
      category: item.category ?? "",
      isActive: item.is_active,
    });
    setDialogOpen(true);
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
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por SKU, nombre o alias..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rubro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los rubros</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rubro</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron ítems
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category ?? "—"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
              <Label>Rubro</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="item-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: Boolean(checked) })}
              />
              <Label htmlFor="item-active">Ítem activo</Label>
            </div>

            {editingItem && (
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <h3 className="text-sm font-semibold">Alias/Códigos</h3>
                  <p className="text-xs text-muted-foreground">Administrá códigos alternativos del ítem.</p>
                </div>
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
                    type="button"
                    size="sm"
                    onClick={() => addAliasMutation.mutate()}
                    disabled={!newAlias.trim()}
                  >
                    Agregar
                  </Button>
                </div>
                <div className="space-y-1">
                  {aliases.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">Sin alias</p>
                  )}
                  {aliases.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{a.alias}</span>
                        {a.is_supplier_code && (
                          <Badge variant="outline" className="text-xs">código</Badge>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteAliasMutation.mutate(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
