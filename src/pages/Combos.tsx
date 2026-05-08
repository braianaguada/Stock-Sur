import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Plus, Pencil, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/errors";
import type { ProductCombo, ProductComboFormLine, ProductComboLine } from "@/features/combos/types";
import { EMPTY_PRODUCT_COMBO_LINE } from "@/features/combos/types";

type ItemOption = {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  is_active: boolean;
};

function buildEmptyForm() {
  return {
    id: null as string | null,
    name: "",
    description: "",
    is_active: true,
    lines: [{ ...EMPTY_PRODUCT_COMBO_LINE }],
  };
}

export default function CombosPage() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [form, setForm] = useState(buildEmptyForm);

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
        .select("id, sku, name, unit, is_active")
        .eq("company_id", currentCompany!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ItemOption[];
    },
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["combos", "lines", currentCompany?.id ?? null, combos.map((combo) => combo.id).join(",")],
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
    if (selectedComboId) return;
    if (combos.length === 0) return;
    setSelectedComboId(combos[0].id);
  }, [combos, selectedComboId]);

  useEffect(() => {
    if (!selectedComboId) {
      setForm(buildEmptyForm());
      return;
    }

    const combo = combos.find((entry) => entry.id === selectedComboId);
    if (!combo) return;
    const comboLines = (linesByComboId.get(selectedComboId) ?? [])
      .slice()
      .sort((a, b) => a.line_order - b.line_order)
      .map((line) => ({
        item_id: line.item_id,
        quantity: Number(line.quantity),
        line_order: line.line_order,
        notes: line.notes ?? "",
      }));

    setForm({
      id: combo.id,
      name: combo.name,
      description: combo.description ?? "",
      is_active: combo.is_active,
      lines: comboLines.length > 0 ? comboLines : [{ ...EMPTY_PRODUCT_COMBO_LINE }],
    });
  }, [combos, linesByComboId, selectedComboId]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => item.is_active)
      .filter((item) => {
        if (!query) return true;
        return [item.sku, item.name, item.unit ?? ""].join(" ").toLowerCase().includes(query);
      })
      .slice(0, 20);
  }, [items, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("Sin empresa activa");
      const name = form.name.trim();
      if (!name) throw new Error("El combo necesita un nombre");

      const normalizedLines = form.lines
        .map((line, index) => ({
          item_id: line.item_id,
          quantity: Number(line.quantity),
          line_order: line.line_order || index + 1,
          notes: line.notes.trim() || null,
        }))
        .filter((line) => line.item_id);

      if (normalizedLines.length === 0) {
        throw new Error("El combo necesita al menos un producto");
      }

      const uniqueItems = new Set<string>();
      for (const line of normalizedLines) {
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          throw new Error("Todas las cantidades deben ser mayores a cero");
        }
        if (!itemsById.has(line.item_id)) {
          throw new Error("No se puede usar un producto fuera de la empresa");
        }
        if (uniqueItems.has(line.item_id)) {
          throw new Error("No se puede repetir el mismo producto dentro del combo");
        }
        uniqueItems.add(line.item_id);
      }

      const comboPayload = {
        company_id: currentCompany.id,
        name,
        description: form.description.trim() || null,
        is_active: form.is_active,
      };

      let comboId = form.id;
      if (!comboId) {
        const { data, error } = await supabase.from("product_combos").insert(comboPayload).select("id").single();
        if (error) throw error;
        comboId = data.id;
      } else {
        const { error } = await supabase.from("product_combos").update(comboPayload).eq("id", comboId);
        if (error) throw error;
        const { error: deleteError } = await supabase.from("product_combo_lines").delete().eq("combo_id", comboId);
        if (deleteError) throw deleteError;
      }

      const linePayload = normalizedLines.map((line, index) => ({
        combo_id: comboId,
        item_id: line.item_id,
        quantity: line.quantity,
        line_order: line.line_order || index + 1,
        notes: line.notes,
      }));
      const { error: insertLinesError } = await supabase.from("product_combo_lines").insert(linePayload);
      if (insertLinesError) throw insertLinesError;
      return comboId;
    },
    onSuccess: async (comboId) => {
      await qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      setSelectedComboId(comboId);
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
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  };

  const addLine = () => {
    setForm((previous) => ({
      ...previous,
      lines: [...previous.lines, { ...EMPTY_PRODUCT_COMBO_LINE, line_order: previous.lines.length + 1 }],
    }));
  };

  const removeLine = (index: number) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.length === 1 ? [{ ...EMPTY_PRODUCT_COMBO_LINE }] : previous.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const selectNewCombo = () => {
    setSelectedComboId(null);
    setForm(buildEmptyForm());
  };

  const comboSummaries = useMemo(
    () =>
      combos.map((combo) => ({
        combo,
        lines: linesByComboId.get(combo.id) ?? [],
      })),
    [combos, linesByComboId],
  );

  return (
    <AppLayout title="Combos" description="Plantillas reutilizables que agrupan productos reales con cantidades configuradas.">
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar combos o productos" />
          </div>

          <Button type="button" className="w-full" onClick={selectNewCombo}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo combo
          </Button>

          <div className="space-y-2">
            {combosLoading || linesLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando combos...
              </div>
            ) : comboSummaries.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No hay combos todavía.
              </div>
            ) : (
              comboSummaries
                .filter(({ combo, lines }) => {
                  if (!search.trim()) return true;
                  const lineText = lines
                    .map((line) => {
                      const item = itemsById.get(line.item_id);
                      return [item?.name ?? "", item?.sku ?? "", line.notes ?? ""].join(" ");
                    })
                    .join(" ");
                  return [combo.name, combo.description ?? "", lineText].join(" ").toLowerCase().includes(search.trim().toLowerCase());
                })
                .map(({ combo, lines }) => (
                  <button
                    type="button"
                    key={combo.id}
                    onClick={() => setSelectedComboId(combo.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedComboId === combo.id ? "border-primary bg-primary/5" : "border-border/60 bg-background hover:border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{combo.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {combo.description ?? "Sin descripcion"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={combo.is_active ? "default" : "secondary"}>{combo.is_active ? "Activo" : "Inactivo"}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleActiveMutation.mutate({ comboId: combo.id, nextValue: !combo.is_active });
                          }}
                        >
                          {combo.is_active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {lines.length} productos
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lines.slice(0, 3).map((line) => {
                        const item = itemsById.get(line.item_id);
                        return (
                          <span key={line.id} className="rounded-full bg-muted px-2 py-1 text-[11px]">
                            {item?.name ?? "Producto"} x {line.quantity}
                          </span>
                        );
                      })}
                      {lines.length > 3 ? <span className="rounded-full bg-muted px-2 py-1 text-[11px]">+{lines.length - 3}</span> : null}
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{form.id ? "Editar combo" : "Nuevo combo"}</div>
              <div className="text-sm text-muted-foreground">
                {form.id ? "Modifica la cabecera y las líneas del combo." : "Crea una plantilla reutilizable con varios productos."}
              </div>
            </div>
            {form.id ? (
              <div className="flex items-center gap-2">
                <Badge variant={form.is_active ? "default" : "secondary"}>{form.is_active ? "Activo" : "Inactivo"}</Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm((previous) => ({ ...previous, is_active: !previous.is_active }))}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {form.is_active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Kit aire acondicionado 1/4 - 1/2" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.is_active ? "active" : "inactive"} onValueChange={(value) => setForm((previous) => ({ ...previous, is_active: value === "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Opcional" />
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Productos del combo</div>
                <div className="text-sm text-muted-foreground">Selecciona productos activos de la empresa y define cantidades/noteas por línea.</div>
              </div>
              <Button type="button" variant="outline" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar línea
              </Button>
            </div>

            {itemsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando productos...
              </div>
            ) : null}

            <div className="space-y-3">
              {form.lines.map((line, index) => (
                <div key={`${line.item_id || "line"}-${index}`} className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[1.7fr_120px_1.2fr_96px]">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Producto</Label>
                    <Select value={line.item_id || "__empty__"} onValueChange={(value) => updateLine(index, { item_id: value === "__empty__" ? "" : value })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">Sin seleccionar</SelectItem>
                        {filteredItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.sku ? `${item.sku} | ` : ""}
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Cantidad</Label>
                    <Input type="number" min={0.001} step="any" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Notas</Label>
                    <Input value={line.notes} onChange={(event) => updateLine(index, { notes: event.target.value })} placeholder="Opcional" />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} title="Eliminar línea">
                      <Pencil className="h-4 w-4 rotate-45" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={selectNewCombo}>
              Limpiar
            </Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar combo
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
