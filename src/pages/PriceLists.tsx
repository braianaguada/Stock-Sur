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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Link2, X } from "lucide-react";

export default function PriceListsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemToAdd, setItemToAdd] = useState<string>("");
  const [form, setForm] = useState({ name: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ["price-lists", search],
    queryFn: async () => {
      let q = supabase
        .from("price_lists")
        .select("id, name, created_at")
        .order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: listItems = [] } = useQuery({
    queryKey: ["price-list-items", selectedListId],
    enabled: !!selectedListId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("price_list_id, item_id, price_override, is_active, items(id, name, sku, unit)")
        .eq("price_list_id", selectedListId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["price-list-items-catalog", itemSearch],
    enabled: itemsDialogOpen,
    queryFn: async () => {
      let q = supabase
        .from("items")
        .select("id, sku, name, unit")
        .eq("is_active", true)
        .order("name")
        .limit(150);

      if (itemSearch.trim()) {
        const s = itemSearch.trim();
        q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const associatedItemIds = useMemo(() => new Set(listItems.map((li: any) => li.item_id)), [listItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("price_lists").insert({ name: form.name });
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

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId || !itemToAdd) throw new Error("Seleccioná un ítem");
      const { error } = await supabase
        .from("price_list_items")
        .upsert({ price_list_id: selectedListId, item_id: itemToAdd, is_active: true }, { onConflict: "price_list_id,item_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setItemToAdd("");
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] });
      toast({ title: "Ítem asociado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("price_list_items")
        .delete()
        .eq("price_list_id", selectedListId!)
        .eq("item_id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] });
      toast({ title: "Ítem quitado" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (args: { itemId: string; is_active?: boolean; price_override?: number | null }) => {
      const { itemId, ...payload } = args;
      const { error } = await supabase
        .from("price_list_items")
        .update(payload)
        .eq("price_list_id", selectedListId!)
        .eq("item_id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] });
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listas de precios</h1>
            <p className="text-muted-foreground">Listas internas con asignación de ítems</p>
          </div>
          <Button onClick={() => { setForm({ name: "" }); setDialogOpen(true); }}>
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
                <TableHead>Creada</TableHead>
                <TableHead className="w-[170px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : priceLists.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No hay listas de precios</TableCell></TableRow>
              ) : priceLists.map((pl: any) => (
                <TableRow key={pl.id}>
                  <TableCell className="font-medium">{pl.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(pl.created_at).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelectedListId(pl.id); setItemSearch(""); setItemToAdd(""); setItemsDialogOpen(true); }}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" /> Ítems
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(pl.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
          <DialogHeader><DialogTitle>Nueva lista de precios</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Crear"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={itemsDialogOpen} onOpenChange={setItemsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Ítems asociados a la lista</DialogTitle></DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold">Agregar ítem</h3>
              <Input placeholder="Buscar por SKU o nombre" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
              <Select value={itemToAdd} onValueChange={setItemToAdd}>
                <SelectTrigger><SelectValue placeholder="Seleccionar ítem" /></SelectTrigger>
                <SelectContent>
                  {items.map((it: any) => (
                    <SelectItem key={it.id} value={it.id} disabled={associatedItemIds.has(it.id)}>
                      {it.sku} — {it.name} ({it.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={() => addItemMutation.mutate()} disabled={!itemToAdd || addItemMutation.isPending}>
                Agregar a la lista
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Ítems en la lista ({listItems.length})</h3>
              <div className="rounded border max-h-[55vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Precio override</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listItems.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sin ítems asociados</TableCell></TableRow>
                    ) : listItems.map((li: any) => (
                      <TableRow key={li.item_id}>
                        <TableCell className="text-sm">{li.items?.sku} — {li.items?.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="any"
                            placeholder="Opcional"
                            defaultValue={li.price_override ?? ""}
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              updateItemMutation.mutate({
                                itemId: li.item_id,
                                price_override: next === "" ? null : Number(next),
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={li.is_active}
                            onCheckedChange={(checked) => updateItemMutation.mutate({ itemId: li.item_id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItemMutation.mutate(li.item_id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
