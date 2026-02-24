import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Link2 } from "lucide-react";
import { buildSuggestedAlias } from "@/lib/matching";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type PendingLine = {
  id: string;
  raw_description: string;
  supplier_code: string | null;
  price: number;
  price_list_versions?: any;
};

export default function PendingPage() {
  const [search, setSearch] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<PendingLine | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [aliasValue, setAliasValue] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [saveAsSupplierCodeAlias, setSaveAsSupplierCodeAlias] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pendingLines = [], isLoading } = useQuery({
    queryKey: ["pending-lines", search],
    queryFn: async () => {
      let q = supabase
        .from("price_list_lines")
        .select("*, price_list_versions(version_date, price_lists(name, suppliers(name)))")
        .eq("match_status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) q = q.ilike("raw_description", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items-search", itemSearch],
    enabled: assignDialogOpen,
    queryFn: async () => {
      let q = supabase.from("items").select("id, name, sku").eq("is_active", true).order("name").limit(50);
      if (itemSearch) q = q.or(`name.ilike.%${itemSearch}%,sku.ilike.%${itemSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const closeAllDialogs = () => {
    setAssignDialogOpen(false);
    setAliasDialogOpen(false);
    setSelectedItemId("");
    setItemSearch("");
    setAliasValue("");
    setNewItemName("");
    setSaveAsSupplierCodeAlias(false);
    setSelectedLine(null);
  };

  const assignLineToItem = async (lineId: string, itemId: string) => {
    const { error } = await supabase
      .from("price_list_lines")
      .update({ item_id: itemId, match_status: "MATCHED" as const })
      .eq("id", lineId);

    if (error) throw error;
  };

  const createAliasForItem = async (itemId: string, alias: string, isSupplierCode: boolean) => {
    const cleanAlias = alias.trim();
    if (!cleanAlias) return;

    const { error } = await supabase
      .from("item_aliases")
      .insert({ item_id: itemId, alias: cleanAlias, is_supplier_code: isSupplierCode });

    if (error) throw error;
  };

  const assignWithoutAliasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine || !selectedItemId) throw new Error("Seleccioná una línea e ítem");
      await assignLineToItem(selectedLine.id, selectedItemId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-lines"] });
      closeAllDialogs();
      toast({ title: "Ítem asignado sin crear alias" });
    },
    onError: (e: any) => toast({ title: "Error al asignar", description: e.message, variant: "destructive" }),
  });

  const assignWithAliasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine || !selectedItemId) throw new Error("Seleccioná una línea e ítem");

      await assignLineToItem(selectedLine.id, selectedItemId);
      await createAliasForItem(selectedItemId, aliasValue, false);

      if (saveAsSupplierCodeAlias && selectedLine.supplier_code) {
        await createAliasForItem(selectedItemId, selectedLine.supplier_code, true);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-lines"] });
      closeAllDialogs();
      toast({ title: "Ítem asignado y alias guardado" });
    },
    onError: (e: any) => toast({ title: "Error al crear alias", description: e.message, variant: "destructive" }),
  });

  const createItemWithAliasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine) throw new Error("Seleccioná una línea");
      const itemName = newItemName.trim();
      const alias = aliasValue.trim();
      if (!itemName) throw new Error("Ingresá el nombre del nuevo ítem");
      if (!alias) throw new Error("Ingresá un alias");

      const { data: createdItem, error: itemError } = await supabase
        .from("items")
        .insert({ name: itemName, is_active: true })
        .select("id")
        .single();
      if (itemError) throw itemError;

      await assignLineToItem(selectedLine.id, createdItem.id);
      await createAliasForItem(createdItem.id, alias, false);

      if (saveAsSupplierCodeAlias && selectedLine.supplier_code) {
        await createAliasForItem(createdItem.id, selectedLine.supplier_code, true);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-lines"] });
      qc.invalidateQueries({ queryKey: ["items-search"] });
      closeAllDialogs();
      toast({ title: "Nuevo ítem creado, asignado y con alias" });
    },
    onError: (e: any) => toast({ title: "Error al crear ítem/alias", description: e.message, variant: "destructive" }),
  });

  const openAssign = (line: PendingLine) => {
    setSelectedLine(line);
    setSelectedItemId("");
    setItemSearch("");
    setAssignDialogOpen(true);
  };

  const openAliasDialog = () => {
    if (!selectedLine || !selectedItemId) {
      toast({ title: "Seleccioná un ítem primero", variant: "destructive" });
      return;
    }

    const suggestedAlias = buildSuggestedAlias(selectedLine.raw_description);
    setAliasValue(suggestedAlias);
    setNewItemName(suggestedAlias || selectedLine.raw_description.slice(0, 80));
    setSaveAsSupplierCodeAlias(Boolean(selectedLine.supplier_code));
    setAssignDialogOpen(false);
    setAliasDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pendientes</h1>
          <p className="text-muted-foreground">Líneas de listas de precios sin asignar a un ítem</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar descripción..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cód. Prov.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Lista / Proveedor</TableHead>
                <TableHead className="w-[80px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : pendingLines.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay líneas pendientes 🎉</TableCell></TableRow>
              ) : pendingLines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm max-w-xs truncate">{l.raw_description}</TableCell>
                  <TableCell className="font-mono text-xs">{l.supplier_code ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number(l.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.price_list_versions?.price_lists?.name ?? "—"} / {l.price_list_versions?.price_lists?.suppliers?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openAssign(l)}>
                      <Link2 className="h-3 w-3 mr-1" /> Asignar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar ítem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm font-medium">{selectedLine?.raw_description}</p>
              <p className="text-xs text-muted-foreground mt-1">Precio: ${Number(selectedLine?.price ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-2">
              <Input placeholder="Buscar ítem..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
              <div className="max-h-48 overflow-auto border rounded-md">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${selectedItemId === item.id ? "bg-accent font-medium" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">{item.sku}</span>
                    {item.name}
                  </button>
                ))}
                {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>}
              </div>
            </div>
            <Button onClick={openAliasDialog} disabled={!selectedItemId} className="w-full">
              Continuar a crear alias
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear alias</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alias">Alias sugerido (editable)</Label>
              <Input id="alias" value={aliasValue} onChange={(e) => setAliasValue(e.target.value)} />
            </div>

            {selectedLine?.supplier_code && (
              <div className="flex items-center gap-2">
                <Checkbox id="supplier-code-alias" checked={saveAsSupplierCodeAlias} onCheckedChange={(checked) => setSaveAsSupplierCodeAlias(Boolean(checked))} />
                <Label htmlFor="supplier-code-alias">Guardar también como alias-código ({selectedLine.supplier_code})</Label>
              </div>
            )}

            <div className="space-y-2 border rounded-md p-3">
              <Label htmlFor="new-item-name">Nuevo ítem (para crear ítem + alias)</Label>
              <Input id="new-item-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nombre del nuevo ítem" />
            </div>

            <div className="grid gap-2">
              <Button
                variant="outline"
                onClick={() => assignWithoutAliasMutation.mutate()}
                disabled={assignWithoutAliasMutation.isPending || assignWithAliasMutation.isPending || createItemWithAliasMutation.isPending}
              >
                Asignar sin alias
              </Button>
              <Button
                onClick={() => assignWithAliasMutation.mutate()}
                disabled={assignWithoutAliasMutation.isPending || assignWithAliasMutation.isPending || createItemWithAliasMutation.isPending}
              >
                Asignar y crear alias
              </Button>
              <Button
                variant="secondary"
                onClick={() => createItemWithAliasMutation.mutate()}
                disabled={assignWithoutAliasMutation.isPending || assignWithAliasMutation.isPending || createItemWithAliasMutation.isPending}
              >
                Crear ítem nuevo + alias
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
