import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Loader2, Search, Plus, Power, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { CategoryBadge, CountBadge, StatusBadge } from "@/components/common/VisualSystem";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/errors";
import { buildItemDisplayMeta, buildItemDisplayName } from "@/lib/item-display";
import type { ProductCombo, ProductComboFormLine, ProductComboLine } from "@/features/combos/types";
import { createComboFormLineState, buildComboFormFromData, buildEmptyComboForm, type ComboFormState } from "@/features/combos/lib/comboForm";
import { buildComboUpsertPayload } from "@/features/combos/lib/buildComboUpsertPayload";
import { filterComboProductOptions, hasComboProductLine } from "@/features/combos/lib/comboProductSearch";

type ItemOption = {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  brand: string | null;
  model: string | null;
  attributes: string | null;
  category: string | null;
  is_active: boolean;
};

export default function CombosPage() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const deferredProductSearch = useDeferredValue(productSearch);
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("edit");
  const [formLoadedForComboId, setFormLoadedForComboId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState<ComboFormState>(buildEmptyComboForm);
  const [pendingSelection, setPendingSelection] = useState<string | "new" | null>(null);

  const { data: combos = [], isLoading: combosLoading } = useQuery({
    queryKey: queryKeys.combos.list(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_combos")
        .select("id, company_id, name, description, is_active, created_at, updated_at, created_by")
        .eq("company_id", currentCompany!.id)
        .order("is_active", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductCombo[];
    },
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["combos", "items", currentCompany?.id ?? null],
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, sku, name, unit, brand, model, attributes, category, is_active")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ItemOption[];
    },
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: queryKeys.combos.lines(currentCompany?.id ?? null, combos.map((combo) => combo.id).join(",")),
    enabled: Boolean(currentCompany?.id) && combos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_combo_lines")
        .select("id, combo_id, item_id, quantity, line_order, notes, created_at")
        .in("combo_id", combos.map((combo) => combo.id))
        .order("line_order");
      if (error) throw error;
      return (data ?? []) as ProductComboLine[];
    },
  });

  const linesByComboId = useMemo(() => {
    const map = new Map<string, ProductComboLine[]>();
    for (const line of lines) {
      const current = map.get(line.combo_id) ?? [];
      current.push(line);
      map.set(line.combo_id, current);
    }
    return map;
  }, [lines]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  useEffect(() => {
    if (formMode === "create") return;
    if (selectedComboId || combos.length === 0) return;
    setSelectedComboId(combos[0].id);
  }, [combos, formMode, selectedComboId]);

  useEffect(() => {
    if (formMode === "create") {
      return;
    }

    if (!selectedComboId) {
      setFormLoadedForComboId(null);
      return;
    }

    if (linesLoading) return;
    if (isDirty && formLoadedForComboId === selectedComboId) return;
    if (formLoadedForComboId === selectedComboId) return;

    const combo = combos.find((entry) => entry.id === selectedComboId);
    if (!combo) return;
    setForm(buildComboFormFromData(combo, linesByComboId.get(selectedComboId) ?? []));
    setFormLoadedForComboId(selectedComboId);
    setIsDirty(false);
  }, [combos, formLoadedForComboId, formMode, isDirty, linesByComboId, linesLoading, selectedComboId]);

  const filteredProductResults = useMemo(() => {
    const query = deferredProductSearch.trim();
    return filterComboProductOptions(items, query);
  }, [deferredProductSearch, items]);

  const comboSummaries = useMemo(() => {
    const summaryById = new Map<string, ProductComboLine[]>();
    for (const combo of combos) {
      summaryById.set(combo.id, linesByComboId.get(combo.id) ?? []);
    }

    if (formMode === "edit" && selectedComboId && form.id === selectedComboId) {
      summaryById.set(
        selectedComboId,
        form.lines
          .filter((line) => line.item_id)
          .map((line, index) => ({
            id: line.clientId,
            combo_id: selectedComboId,
            item_id: line.item_id,
            quantity: Number(line.quantity),
            line_order: index + 1,
            notes: line.notes || null,
            created_at: "",
          })),
      );
    }

    return combos.map((combo) => ({
      combo,
      lines: summaryById.get(combo.id) ?? [],
    }));
  }, [combos, form.id, form.lines, formMode, linesByComboId, selectedComboId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("Sin empresa activa");
      const normalizedLines = form.lines
        .map(({ clientId: _clientId, ...line }, index) => ({ ...line, line_order: index + 1 }))
        .filter((line) => line.item_id);
      if (!form.name.trim()) throw new Error("El combo necesita un nombre");
      if (normalizedLines.length === 0) throw new Error("El combo necesita al menos un producto");
      if (normalizedLines.some((line) => Number(line.quantity) <= 0)) throw new Error("Las cantidades deben ser mayores a cero");
      if (new Set(normalizedLines.map((line) => line.item_id)).size !== normalizedLines.length) throw new Error("No se permiten productos duplicados en el combo");
      const payload = buildComboUpsertPayload({
        companyId: currentCompany.id,
        comboId: form.id,
        name: form.name,
        description: "",
        isActive: form.is_active,
        lines: normalizedLines,
      });
      const { data, error } = await supabase.rpc("upsert_product_combo_with_lines", payload);
      if (error) throw error;
      return data as string;
    },
    onSuccess: async (comboId) => {
      await qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      await qc.invalidateQueries({ queryKey: queryKeys.combos.linesAll() });
      setSelectedComboId(comboId);
      setFormMode("edit");
      setFormLoadedForComboId(null);
      setIsDirty(false);
      toast({ title: "Combo guardado", description: "Los cambios quedaron registrados." });
    },
    onError: (error) => {
      toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ comboId, nextValue }: { comboId: string; nextValue: boolean }) => {
      const { error } = await supabase.from("product_combos").update({ is_active: nextValue }).eq("id", comboId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
    },
  });

  const updateLine = (index: number, patch: Partial<ProductComboFormLine>) => {
    setIsDirty(true);
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  };

  const addProductToCombo = (itemId: string) => {
    if (hasComboProductLine(form.lines, itemId)) {
      toast({ title: "El producto ya esta en el combo", description: "Edita la cantidad en la linea existente." });
      return;
    }
    setIsDirty(true);
    setForm((previous) => ({
      ...previous,
      lines: [
        ...previous.lines.filter((line) => line.item_id),
        createComboFormLineState({ item_id: itemId, quantity: 1, notes: "", line_order: previous.lines.length + 1 }),
      ],
    }));
    setProductSearch("");
  };

  const removeLine = (index: number) => {
    setIsDirty(true);
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const applyNewComboSelection = () => {
    setSelectedComboId(null);
    setFormMode("create");
    setFormLoadedForComboId(null);
    setIsDirty(false);
    setForm(buildEmptyComboForm());
  };

  const applyExistingComboSelection = (comboId: string) => {
    if (selectedComboId === comboId && formMode === "edit") return;
    setFormMode("edit");
    setSelectedComboId(comboId);
    setFormLoadedForComboId(null);
    setIsDirty(false);
  };

  const requestSelection = (selection: string | "new") => {
    if (selection === "new" && formMode === "create" && !isDirty) return;
    if (selection === selectedComboId && formMode === "edit") return;
    if (isDirty) {
      setPendingSelection(selection);
      return;
    }
    if (selection === "new") applyNewComboSelection();
    else applyExistingComboSelection(selection);
  };

  const confirmSelection = () => {
    if (!pendingSelection) return;
    if (pendingSelection === "new") applyNewComboSelection();
    else applyExistingComboSelection(pendingSelection);
    setPendingSelection(null);
  };

  const visibleComboSummaries = comboSummaries.filter(({ combo, lines: comboLines }) => {
    if (!search.trim()) return true;
    const lineText = comboLines
      .map((line) => {
        const item = itemsById.get(line.item_id);
        return [item?.name ?? "", item?.sku ?? "", line.notes ?? ""].join(" ");
      })
      .join(" ");
    return [combo.name, lineText].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  });

  const activeComboCount = combos.filter((combo) => combo.is_active).length;

  return (
    <AppLayout title="Combos" description="Plantillas reutilizables que agrupan productos reales con cantidades configuradas.">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <Card className="overflow-hidden border-border/70 shadow-none xl:sticky xl:top-4">
          <CardHeader className="space-y-4 border-b bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Catálogo de combos</CardTitle>
                <CardDescription>Seleccioná una plantilla para revisar sus productos.</CardDescription>
              </div>
              <CountBadge>{activeComboCount} activos</CountBadge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar combo o producto" />
            </div>
            <Button type="button" className="w-full" onClick={() => requestSelection("new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo combo
            </Button>
          </CardHeader>

          <CardContent className="max-h-[calc(100vh-19rem)] space-y-2 overflow-y-auto p-3">
            {combosLoading || linesLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando combos...
              </div>
            ) : combos.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No hay combos todavía. Creá el primero para reutilizar grupos de productos.
              </div>
            ) : visibleComboSummaries.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No encontramos combos ni productos que coincidan con la búsqueda.
              </div>
            ) : (
              visibleComboSummaries.map(({ combo, lines: comboLines }) => (
                <div
                    key={combo.id}
                    className={`rounded-lg border p-3 transition-colors ${selectedComboId === combo.id && formMode === "edit" ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-background hover:border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => requestSelection(combo.id)} className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <span className="block truncate font-medium">{combo.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {comboLines.length} producto{comboLines.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge tone={combo.is_active ? "success" : "muted"}>{combo.is_active ? "Activo" : "Inactivo"}</StatusBadge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => toggleActiveMutation.mutate({ comboId: combo.id, nextValue: !combo.is_active })}
                        >
                          {combo.is_active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {comboLines.slice(0, 3).map((line) => {
                        const item = itemsById.get(line.item_id);
                        return (
                          <CategoryBadge key={line.id}>
                            {item?.name ?? "Producto"} x {line.quantity}
                          </CategoryBadge>
                        );
                      })}
                      {comboLines.length > 3 ? <CountBadge>+{comboLines.length - 3}</CountBadge> : null}
                    </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-border/70 shadow-none">
          <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{form.id ? "Editar combo" : "Nuevo combo"}</CardTitle>
              <CardDescription>
                {form.id ? "Modificá la configuración y los productos del combo." : "Creá una plantilla reutilizable con varios productos."}
              </CardDescription>
            </div>
            {form.id ? (
              <div className="flex flex-wrap items-center gap-2">
                {isDirty ? <StatusBadge tone="warning">Cambios sin guardar</StatusBadge> : null}
                <StatusBadge tone={form.is_active ? "success" : "muted"}>{form.is_active ? "Activo" : "Inactivo"}</StatusBadge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDirty(true);
                    setForm((previous) => ({ ...previous, is_active: !previous.is_active }));
                  }}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {form.is_active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(event) => {
                setIsDirty(true);
                setForm((previous) => ({ ...previous, name: event.target.value }));
              }} placeholder="Kit aire acondicionado 1/4 - 1/2" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.is_active ? "active" : "inactive"} onValueChange={(value) => {
                setIsDirty(true);
                setForm((previous) => ({ ...previous, is_active: value === "active" }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Productos del combo</div>
                <div className="text-sm text-muted-foreground">Busca productos activos, agregalos una vez y ajusta cantidades/notas por linea.</div>
              </div>
            </div>

            {itemsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando productos...
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border bg-background p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar por SKU, nombre, marca, modelo, atributos o categoria..."
                />
              </div>
              {productSearch.trim() ? (
                <div className="space-y-2">
                  {filteredProductResults.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">No hay productos activos para esa busqueda.</div>
                  ) : filteredProductResults.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border/60 px-3 py-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium break-words">{buildItemDisplayName(item)}</div>
                        <div className="text-xs text-muted-foreground break-words">
                          {buildItemDisplayMeta(item) || "Sin identificadores"}
                          {" | "}
                          {item.category || "Sin categoria"}
                          {" | Unidad: "}
                          {item.unit || "Sin unidad"}
                        </div>
                      </div>
                      <Button type="button" size="sm" onClick={() => addProductToCombo(item.id)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

              <div className="overflow-x-auto rounded-lg border bg-background">
                <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-32">Cantidad</TableHead>
                  <TableHead className="w-20">Unidad</TableHead>
                  <TableHead className="text-right">Quitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Todavia no agregaste productos al combo.
                    </TableCell>
                  </TableRow>
                ) : form.lines.map((line, index) => {
                  const item = itemsById.get(line.item_id);
                  return (
                    <TableRow key={line.clientId}>
                      <TableCell className="py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-5 break-words">
                            {item ? buildItemDisplayName(item) : "Producto no encontrado"}
                          </div>
                          {item ? (
                            <div className="text-xs text-muted-foreground break-words">
                              {buildItemDisplayMeta(item) || "Sin identificadores"}
                              {" | "}
                              {item.category || "Sin categoria"}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <Input
                          className="h-9 w-24"
                          type="number"
                          min={0.001}
                          step="any"
                          value={line.quantity}
                          onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="py-3 text-sm align-middle">{item?.unit || "-"}</TableCell>
                      <TableCell className="py-3 text-right align-middle">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} title="Eliminar linea">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => requestSelection("new")}>
                Limpiar
              </Button>
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || form.lines.length === 0}>
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar combo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(pendingSelection)} onOpenChange={(open) => { if (!open) setPendingSelection(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios realizados en este combo se perderán. Esta acción no modifica la versión guardada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSelection}>Descartar cambios</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
