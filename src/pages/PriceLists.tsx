import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { PriceListItemsDialog } from "@/components/price-lists/PriceListItemsDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Trash2, Link2 } from "lucide-react";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { getErrorMessage } from "@/lib/errors";

interface PriceList {
  id: string;
  name: string;
  created_at: string;
  flete_pct: number;
  utilidad_pct: number;
  impuesto_pct: number;
  round_mode: "none" | "integer" | "tens" | "hundreds" | "x99";
  round_to: number;
}

interface CatalogItem {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
}

interface PriceListItem {
  price_list_id: string;
  item_id: string;
  is_active: boolean;
  base_cost: number;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  final_price_override: number | null;
  items: CatalogItem | null;
}

type LineDraft = {
  base_cost: string;
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
  final_price_override: string;
};

type ListConfigDraft = {
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
  round_mode: PriceList["round_mode"];
  round_to: string;
};

const DEFAULT_FORM = {
  name: "",
  flete_pct: "10",
  utilidad_pct: "55",
  impuesto_pct: "21",
  round_mode: "none" as PriceList["round_mode"],
  round_to: "1",
};

const parseNonNegative = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const parseNullableNonNegative = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

const sanitizeNonNegativeDraft = (value: string) => value.replace(",", ".").replace(/-/g, "");

export default function PriceListsPage() {
  const { currentCompany } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listToDelete, setListToDelete] = useState<PriceList | null>(null);
  const [listItemToRemove, setListItemToRemove] = useState<PriceListItem | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemToAdd, setItemToAdd] = useState<string>("");
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(DEFAULT_FORM);
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [listConfigDraft, setListConfigDraft] = useState<ListConfigDraft | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ["price-lists", search],
    queryFn: async () => {
      let q = supabase
        .from("price_lists")
        .select("id, name, created_at, flete_pct, utilidad_pct, impuesto_pct, round_mode, round_to")
        .order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data ?? []) as PriceList[];
    },
  });

  const { data: listItems = [] } = useQuery({
    queryKey: ["price-list-items", selectedListId],
    enabled: !!selectedListId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("price_list_id, item_id, is_active, base_cost, flete_pct, utilidad_pct, impuesto_pct, final_price_override, items(id, name, sku, unit)")
        .eq("price_list_id", selectedListId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceListItem[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["price-list-items-catalog", currentCompany?.id ?? "no-company", itemSearch],
    enabled: itemsDialogOpen && Boolean(currentCompany),
    queryFn: async () => {
      let q = supabase
        .from("items")
        .select("id, sku, name, unit")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true)
        .order("name")
        .limit(150);
      if (itemSearch.trim()) {
        const s = itemSearch.trim();
        q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });
  const associatedItemIds = useMemo(() => new Set(listItems.map((li) => li.item_id)), [listItems]);
  const selectedList = useMemo(() => priceLists.find((pl) => pl.id === selectedListId) ?? null, [priceLists, selectedListId]);
  const availableItems = useMemo(() => items.filter((it) => !associatedItemIds.has(it.id)), [items, associatedItemIds]);
  const selectedCatalogItemIds = useMemo(() => Object.entries(selectedCatalogItems).filter(([, checked]) => checked).map(([id]) => id), [selectedCatalogItems]);

  useEffect(() => {
    const nextDrafts = Object.fromEntries(listItems.map((line) => [
      line.item_id,
      {
        base_cost: String(line.base_cost ?? 0),
        flete_pct: line.flete_pct === null ? "" : String(line.flete_pct),
        utilidad_pct: line.utilidad_pct === null ? "" : String(line.utilidad_pct),
        impuesto_pct: line.impuesto_pct === null ? "" : String(line.impuesto_pct),
        final_price_override: line.final_price_override === null ? "" : String(line.final_price_override),
      },
    ]));
    setLineDrafts(nextDrafts);
  }, [listItems]);

  useEffect(() => {
    if (!selectedList) {
      setListConfigDraft(null);
      return;
    }
    setListConfigDraft({
      flete_pct: String(selectedList.flete_pct ?? 0),
      utilidad_pct: String(selectedList.utilidad_pct ?? 0),
      impuesto_pct: String(selectedList.impuesto_pct ?? 0),
      round_mode: selectedList.round_mode,
      round_to: String(selectedList.round_to ?? 1),
    });
  }, [selectedList]);

  const applyRounding = (value: number, roundMode: PriceList["round_mode"], roundTo: number) => {
    switch (roundMode) {
      case "integer": return Math.round(value);
      case "tens": return Math.round(value / 10) * 10;
      case "hundreds": return Math.round(value / 100) * 100;
      case "x99": return value <= 0 ? 0 : Math.floor(value) + 0.99;
      case "none":
      default:
        if (!Number.isFinite(roundTo) || roundTo <= 0 || roundTo === 1) return value;
        return Math.round(value / roundTo) * roundTo;
    }
  };

  const calculateFinalPrice = (line: PriceListItem) => {
    if (!selectedList) return 0;
    const listFlete = parseNullableNonNegative(listConfigDraft?.flete_pct ?? "") ?? selectedList.flete_pct;
    const listUtilidad = parseNullableNonNegative(listConfigDraft?.utilidad_pct ?? "") ?? selectedList.utilidad_pct;
    const listImpuesto = parseNullableNonNegative(listConfigDraft?.impuesto_pct ?? "") ?? selectedList.impuesto_pct;
    const listRoundMode = listConfigDraft?.round_mode ?? selectedList.round_mode;
    const listRoundTo = parseNullableNonNegative(listConfigDraft?.round_to ?? "") ?? selectedList.round_to;
    const draft = lineDrafts[line.item_id];
    const baseCost = parseNonNegative(draft?.base_cost ?? "0", 0);
    const manual = parseNullableNonNegative(draft?.final_price_override ?? "");
    if (manual !== null && manual > 0) return manual;
    if (baseCost <= 0) return 0;
    const flete = parseNullableNonNegative(draft?.flete_pct ?? "") ?? listFlete;
    const utilidad = parseNullableNonNegative(draft?.utilidad_pct ?? "") ?? listUtilidad;
    const impuesto = parseNullableNonNegative(draft?.impuesto_pct ?? "") ?? listImpuesto;
    const computed = baseCost * (1 + flete / 100) * (1 + utilidad / 100) * (1 + impuesto / 100);
    return applyRounding(computed, listRoundMode, listRoundTo);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("price_lists").insert({
        name: form.name,
        flete_pct: parseNonNegative(form.flete_pct, 0),
        utilidad_pct: parseNonNegative(form.utilidad_pct, 0),
        impuesto_pct: parseNonNegative(form.impuesto_pct, 0),
        round_mode: form.round_mode,
        round_to: Math.max(0.0001, parseNonNegative(form.round_to, 1)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-lists"] });
      setDialogOpen(false);
      toast({ title: "Lista creada" });
    },
    onError: (e: unknown) => toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await deleteByStrategy({ table: "price_lists", id }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-lists"] }); toast({ title: "Lista eliminada" }); },
  });

  const updateListConfigMutation = useMutation({
    mutationFn: async (payload: Partial<Pick<PriceList, "flete_pct" | "utilidad_pct" | "impuesto_pct" | "round_mode" | "round_to">>) => {
      if (!selectedListId) return;
      const { error } = await supabase.from("price_lists").update(payload).eq("id", selectedListId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-lists"] }); },
    onError: (e: unknown) => toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId || !itemToAdd) throw new Error("Selecciona un item");
      const { error } = await supabase.from("price_list_items").upsert({
        price_list_id: selectedListId,
        item_id: itemToAdd,
        is_active: true,
        base_cost: 0,
        final_price_override: null,
      }, { onConflict: "price_list_id,item_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setItemToAdd("");
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] });
      toast({ title: "Item asociado" });
    },
    onError: (e: unknown) => toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" }),
  });
  const addItemsBulkMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!selectedListId || itemIds.length === 0) throw new Error("No hay items seleccionados");
      const payload = itemIds.map((itemId) => ({
        price_list_id: selectedListId,
        item_id: itemId,
        is_active: true,
        base_cost: 0,
        final_price_override: null,
      }));
      const { error } = await supabase.from("price_list_items").upsert(payload, { onConflict: "price_list_id,item_id" });
      if (error) throw error;
    },
    onSuccess: (_data, itemIds) => {
      setSelectedCatalogItems({});
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] });
      toast({ title: `${itemIds.length} items agregados` });
    },
    onError: (e: unknown) => toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" }),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await deleteByStrategy({ table: "price_list_items", idColumn: "item_id", id: itemId, eq: { price_list_id: selectedListId! } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] });
      toast({ title: "Item quitado" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (args: {
      itemId: string;
      base_cost?: number;
      flete_pct?: number | null;
      utilidad_pct?: number | null;
      impuesto_pct?: number | null;
      final_price_override?: number | null;
    }) => {
      const { itemId, ...payload } = args;
      const { error } = await supabase
        .from("price_list_items")
        .update(payload)
        .eq("price_list_id", selectedListId!)
        .eq("item_id", itemId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-list-items", selectedListId] }); },
  });

  const handleLineDraftChange = (itemId: string, key: keyof LineDraft, value: string) => {
    setLineDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [key]: value } }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listas de precios</h1>
            <p className="text-muted-foreground">Listas internas con asignacion de items</p>
          </div>
          <Button onClick={() => { setForm(DEFAULT_FORM); setDialogOpen(true); }}>
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
              ) : priceLists.map((pl) => (
                <TableRow key={pl.id}>
                  <TableCell className="font-medium">{pl.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(pl.created_at).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedListId(pl.id);
                          setItemSearch("");
                          setItemToAdd("");
                          setSelectedCatalogItems({});
                          setItemsDialogOpen(true);
                        }}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" /> Items
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setListToDelete(pl)}>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Flete %</Label><Input min={0} type="number" step="any" value={form.flete_pct} onChange={(e) => setForm({ ...form, flete_pct: e.target.value })} /></div>
              <div className="space-y-2"><Label>Utilidad %</Label><Input min={0} type="number" step="any" value={form.utilidad_pct} onChange={(e) => setForm({ ...form, utilidad_pct: e.target.value })} /></div>
              <div className="space-y-2"><Label>Impuesto %</Label><Input min={0} type="number" step="any" value={form.impuesto_pct} onChange={(e) => setForm({ ...form, impuesto_pct: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Redondeo</Label>
                <Select value={form.round_mode} onValueChange={(value) => setForm({ ...form, round_mode: value as PriceList["round_mode"] })}>
                  <SelectTrigger><SelectValue placeholder="Modo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin redondeo</SelectItem>
                    <SelectItem value="integer">Entero</SelectItem>
                    <SelectItem value="tens">Decenas</SelectItem>
                    <SelectItem value="hundreds">Centenas</SelectItem>
                    <SelectItem value="x99">Terminar en .99</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Redondeo cada</Label><Input min={0} type="number" step="any" value={form.round_to} onChange={(e) => setForm({ ...form, round_to: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Crear"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PriceListItemsDialog
        open={itemsDialogOpen}
        onOpenChange={setItemsDialogOpen}
        selectedList={selectedList}
        listItems={listItems}
        availableItems={availableItems}
        itemSearch={itemSearch}
        onItemSearchChange={setItemSearch}
        itemToAdd={itemToAdd}
        onItemToAddChange={setItemToAdd}
        onAddItem={() => addItemMutation.mutate()}
        addItemPending={addItemMutation.isPending}
        selectedCatalogItems={selectedCatalogItems}
        onToggleCatalogItem={(itemId, checked) => setSelectedCatalogItems((prev) => ({ ...prev, [itemId]: checked }))}
        selectedCatalogItemIds={selectedCatalogItemIds}
        onAddSelected={() => addItemsBulkMutation.mutate(selectedCatalogItemIds)}
        onAddFiltered={() => addItemsBulkMutation.mutate(availableItems.map((it) => it.id))}
        addItemsBulkPending={addItemsBulkMutation.isPending}
        listConfigDraft={listConfigDraft}
        onListConfigDraftChange={setListConfigDraft}
        onUpdateListConfig={(payload) => updateListConfigMutation.mutate(payload)}
        lineDrafts={lineDrafts}
        onLineDraftChange={handleLineDraftChange}
        onUpdateItem={(args) => updateItemMutation.mutate(args)}
        calculateFinalPrice={calculateFinalPrice}
        onRequestRemoveItem={setListItemToRemove}
        parseNonNegative={parseNonNegative}
        parseNullableNonNegative={parseNullableNonNegative}
        sanitizeNonNegativeDraft={sanitizeNonNegativeDraft}
        onSaveAndClose={() => setItemsDialogOpen(false)}
      />

      <ConfirmDeleteDialog open={!!listToDelete} onOpenChange={(open) => { if (!open) setListToDelete(null); }} title="Eliminar lista" description={listToDelete ? `Esta accion eliminara la lista "${listToDelete.name}" de forma permanente.` : ""} isPending={deleteMutation.isPending} onConfirm={() => { if (!listToDelete) return; deleteMutation.mutate(listToDelete.id); setListToDelete(null); }} />

      <ConfirmDeleteDialog open={!!listItemToRemove} onOpenChange={(open) => { if (!open) setListItemToRemove(null); }} title="Quitar item de la lista" description={listItemToRemove ? `Se quitara "${listItemToRemove.items?.name ?? "item"}" de esta lista de precios.` : ""} isPending={removeItemMutation.isPending} confirmLabel="Quitar" onConfirm={() => { if (!listItemToRemove) return; removeItemMutation.mutate(listItemToRemove.item_id); setListItemToRemove(null); }} />
    </AppLayout>
  );
}
