import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query-keys";
import type { ProductCombo, ProductComboLine } from "@/features/combos/types";

export default function CombosPage() {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const { data: combos = [] } = useQuery({
    queryKey: queryKeys.combos.list(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("product_combos").select("*").eq("company_id", currentCompany!.id).order("name");
      if (error) throw error;
      return (data ?? []) as ProductCombo[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["combos-items", currentCompany?.id ?? null],
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, sku, name").eq("company_id", currentCompany!.id).eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["combos-lines", combos.map((combo) => combo.id).join(",")],
    enabled: combos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_combo_lines").select("*").in("combo_id", combos.map((combo) => combo.id));
      if (error) throw error;
      return (data ?? []) as ProductComboLine[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("Sin empresa activa");
      const { data, error } = await supabase.from("product_combos").insert({ company_id: currentCompany.id, name, description: description || null }).select("id").single();
      if (error) throw error;
      if (itemId) {
        const { error: lineError } = await supabase.from("product_combo_lines").insert({ combo_id: data.id, item_id: itemId, quantity: Number(quantity) || 1, line_order: 1 });
        if (lineError) throw lineError;
      }
    },
    onSuccess: async () => {
      setName(""); setDescription(""); setItemId(""); setQuantity("1");
      await qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
    },
  });

  const counts = useMemo(() => new Map(combos.map((combo) => [combo.id, lines.filter((line) => line.combo_id === combo.id).length])), [combos, lines]);

  return (
    <AppLayout title="Combos" description="Plantillas reutilizables que expanden productos reales en documentos.">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            {combos.map((combo) => (
              <div key={combo.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{combo.name}</div>
                    <div className="text-sm text-muted-foreground">{combo.description ?? "Sin descripcion"}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{counts.get(combo.id) ?? 0} productos</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del combo" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripcion" />
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger><SelectValue placeholder="Agregar producto" /></SelectTrigger>
            <SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={1} />
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim()}>Guardar</Button>
        </div>
      </div>
    </AppLayout>
  );
}
