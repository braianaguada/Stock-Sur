import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildSuggestedAlias } from "@/lib/matching";
import { invalidatePendingQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import type { PendingItemOption, PendingLine } from "@/features/pending/types";

type UsePendingMatchingOptions = {
  companyId: string | null | undefined;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
};

export function usePendingMatching({
  companyId,
  toast,
}: UsePendingMatchingOptions) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<PendingLine | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const deferredItemSearch = useDeferredValue(itemSearch);
  const [aliasValue, setAliasValue] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [saveAsSupplierCodeAlias, setSaveAsSupplierCodeAlias] = useState(false);
  const qc = useQueryClient();

  const pendingLinesQuery = useQuery({
    queryKey: queryKeys.pending.lines(companyId ?? null, deferredSearch),
    enabled: Boolean(companyId),
    queryFn: async () => {
      let query = supabase
        .from("price_list_lines")
        .select("*, price_list_versions(version_date, price_lists(name, suppliers(name)))")
        .eq("company_id", companyId!)
        .eq("match_status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(200);

      if (deferredSearch) {
        query = query.ilike("raw_description", `%${deferredSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PendingLine[];
    },
  });

  const itemsQuery = useQuery({
    queryKey: queryKeys.pending.itemsSearch(companyId ?? null, deferredItemSearch),
    enabled: assignDialogOpen && Boolean(companyId),
    queryFn: async () => {
      let query = supabase
        .from("items")
        .select("id, name, sku")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name")
        .limit(50);

      if (deferredItemSearch) {
        query = query.or(`name.ilike.%${deferredItemSearch}%,sku.ilike.%${deferredItemSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PendingItemOption[];
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
      .eq("company_id", companyId!)
      .eq("id", lineId);

    if (error) throw error;
  };

  const createAliasForItem = async (itemId: string, alias: string, isSupplierCode: boolean) => {
    const cleanAlias = alias.trim();
    if (!cleanAlias) return;

    const { error } = await supabase
      .from("item_aliases")
      .insert({
        company_id: companyId!,
        item_id: itemId,
        alias: cleanAlias,
        is_supplier_code: isSupplierCode,
      });

    if (error) throw error;
  };

  const assignWithoutAliasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine || !selectedItemId) throw new Error("Selecciona una linea y un item");
      await assignLineToItem(selectedLine.id, selectedItemId);
    },
    onSuccess: async () => {
      await invalidatePendingQueries(qc);
      closeAllDialogs();
      toast({ title: "Item asignado sin crear alias" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al asignar",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const assignWithAliasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine || !selectedItemId) throw new Error("Selecciona una linea y un item");

      await assignLineToItem(selectedLine.id, selectedItemId);
      await createAliasForItem(selectedItemId, aliasValue, false);

      if (saveAsSupplierCodeAlias && selectedLine.supplier_code) {
        await createAliasForItem(selectedItemId, selectedLine.supplier_code, true);
      }
    },
    onSuccess: async () => {
      await invalidatePendingQueries(qc);
      closeAllDialogs();
      toast({ title: "Item asignado y alias guardado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al crear alias",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const createItemWithAliasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine) throw new Error("Selecciona una linea");

      const itemName = newItemName.trim();
      const alias = aliasValue.trim();

      if (!itemName) throw new Error("Ingresa el nombre del nuevo item");
      if (!alias) throw new Error("Ingresa un alias");

      const { data: createdItem, error: itemError } = await supabase
        .from("items")
        .insert({ company_id: companyId!, name: itemName, is_active: true })
        .select("id")
        .single();

      if (itemError) throw itemError;

      await assignLineToItem(selectedLine.id, createdItem.id);
      await createAliasForItem(createdItem.id, alias, false);

      if (saveAsSupplierCodeAlias && selectedLine.supplier_code) {
        await createAliasForItem(createdItem.id, selectedLine.supplier_code, true);
      }
    },
    onSuccess: async () => {
      await invalidatePendingQueries(qc);
      closeAllDialogs();
      toast({ title: "Nuevo item creado, asignado y con alias" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al crear item/alias",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const openAssign = (line: PendingLine) => {
    setSelectedLine(line);
    setSelectedItemId("");
    setItemSearch("");
    setAssignDialogOpen(true);
  };

  const openAliasDialog = () => {
    if (!selectedLine || !selectedItemId) {
      toast({ title: "Selecciona un item primero", variant: "destructive" });
      return;
    }

    const suggestedAlias = buildSuggestedAlias(selectedLine.raw_description);
    setAliasValue(suggestedAlias);
    setNewItemName(suggestedAlias || selectedLine.raw_description.slice(0, 80));
    setSaveAsSupplierCodeAlias(Boolean(selectedLine.supplier_code));
    setAssignDialogOpen(false);
    setAliasDialogOpen(true);
  };

  return {
    aliasDialogOpen,
    aliasValue,
    assignDialogOpen,
    createItemWithAliasMutation,
    isLoading: pendingLinesQuery.isLoading,
    isSubmitting:
      assignWithoutAliasMutation.isPending
      || assignWithAliasMutation.isPending
      || createItemWithAliasMutation.isPending,
    itemSearch,
    items: itemsQuery.data ?? [],
    newItemName,
    openAliasDialog,
    openAssign,
    pendingLines: pendingLinesQuery.data ?? [],
    saveAsSupplierCodeAlias,
    search,
    selectedItemId,
    selectedLine,
    setAliasDialogOpen,
    setAliasValue,
    setAssignDialogOpen,
    setItemSearch,
    setNewItemName,
    setSaveAsSupplierCodeAlias,
    setSearch,
    setSelectedItemId,
    assignWithoutAlias: () => assignWithoutAliasMutation.mutate(),
    assignWithAlias: () => assignWithAliasMutation.mutate(),
    createItemWithAlias: () => createItemWithAliasMutation.mutate(),
  };
}
