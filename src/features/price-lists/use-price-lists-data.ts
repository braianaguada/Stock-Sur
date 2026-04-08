import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { getErrorMessage } from "@/lib/errors";
import { invalidatePricingQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import type {
  BasePriceRow,
  PriceListFormState,
  PriceListHistoryRow,
  PriceListProductRow,
  PriceListSummary,
} from "@/features/price-lists/types";
import { parseNonNegative } from "@/features/price-lists/utils";

type BaseCatalogRow = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  unit: string | null;
};

type PricingBaseDbRow = {
  item_id: string;
  base_cost: number;
  updated_at: string;
  updated_by: string | null;
};

type PricingBaseHistoryDbRow = {
  item_id: string;
  previous_base_cost: number;
  new_base_cost: number;
  changed_at: string;
  changed_by: string | null;
};

type PriceListDbRow = {
  id: string;
  name: string;
  description: string | null;
  flete_pct: number;
  utilidad_pct: number;
  impuesto_pct: number;
  status: string;
  last_recalculated_at: string | null;
  last_recalculated_by: string | null;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
  created_by: string | null;
};

type PriceListSnapshotDbRow = {
  item_id: string;
  base_cost: number;
  calculated_price: number;
  needs_recalculation: boolean;
  last_calculated_at: string | null;
  last_calculated_by: string | null;
};

type UsePriceListsDataParams = {
  basePage: number;
  basePageSize: number;
  baseSearch: string;
  detailPage: number;
  detailPageSize: number;
  detailSearch: string;
  listSearch: string;
  selectedListId: string | null;
};

export function usePriceListsData({
  basePage,
  basePageSize,
  baseSearch,
  detailPage,
  detailPageSize,
  detailSearch,
  listSearch,
  selectedListId,
}: UsePriceListsDataParams) {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: catalogItems = [] } = useQuery({
    queryKey: queryKeys.pricing.catalogItems(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, sku, name, brand, model, category, unit")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true)
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as BaseCatalogRow[];
    },
  });

  const { data: pricingBaseRows = [] } = useQuery({
    queryKey: queryKeys.pricing.base(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_pricing_base")
        .select("item_id, base_cost, updated_at, updated_by")
        .eq("company_id", currentCompany!.id);
      if (error) throw error;
      return (data ?? []) as PricingBaseDbRow[];
    },
  });

  const { data: pricingBaseHistoryRows = [] } = useQuery({
    queryKey: queryKeys.pricing.baseHistory(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_pricing_base_history")
        .select("item_id, previous_base_cost, new_base_cost, changed_at, changed_by")
        .eq("company_id", currentCompany!.id)
        .order("changed_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PricingBaseHistoryDbRow[];
    },
  });

  const { data: priceListsRaw = [] } = useQuery({
    queryKey: queryKeys.pricing.lists(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name, description, flete_pct, utilidad_pct, impuesto_pct, status, last_recalculated_at, last_recalculated_by, updated_at, updated_by, created_at, created_by")
        .eq("company_id", currentCompany!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PriceListDbRow[];
    },
  });

  const { data: priceListCounts = [] } = useQuery({
    queryKey: queryKeys.pricing.listCounts(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("price_list_id, needs_recalculation, is_active")
        .eq("company_id", currentCompany!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: selectedListSnapshots = [] } = useQuery({
    queryKey: queryKeys.pricing.listProducts(currentCompany?.id ?? null, selectedListId),
    enabled: Boolean(currentCompany && selectedListId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("item_id, base_cost, calculated_price, needs_recalculation, last_calculated_at, last_calculated_by")
        .eq("company_id", currentCompany!.id)
        .eq("price_list_id", selectedListId!)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as PriceListSnapshotDbRow[];
    },
  });

  const { data: selectedListHistory = [] } = useQuery({
    queryKey: queryKeys.pricing.listHistory(currentCompany?.id ?? null, selectedListId),
    enabled: Boolean(currentCompany && selectedListId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_history")
        .select("id, event_type, affected_items_count, details, created_at, created_by")
        .eq("company_id", currentCompany!.id)
        .eq("price_list_id", selectedListId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PriceListHistoryRow[];
    },
  });

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of pricingBaseRows) if (row.updated_by) ids.add(row.updated_by);
    for (const row of pricingBaseHistoryRows) if (row.changed_by) ids.add(row.changed_by);
    for (const row of priceListsRaw) {
      if (row.created_by) ids.add(row.created_by);
      if (row.updated_by) ids.add(row.updated_by);
      if (row.last_recalculated_by) ids.add(row.last_recalculated_by);
    }
    for (const row of selectedListSnapshots) if (row.last_calculated_by) ids.add(row.last_calculated_by);
    for (const row of selectedListHistory) if (row.created_by) ids.add(row.created_by);
    return Array.from(ids);
  }, [priceListsRaw, pricingBaseHistoryRows, pricingBaseRows, selectedListHistory, selectedListSnapshots]);

  const { data: profiles = [] } = useQuery({
    queryKey: queryKeys.pricing.userProfiles(userIds),
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileNameByUserId = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile.full_name || profile.user_id.slice(0, 8)])),
    [profiles],
  );

  const basePricingByItemId = useMemo(
    () => new Map(pricingBaseRows.map((row) => [row.item_id, row])),
    [pricingBaseRows],
  );

  const latestHistoryByItemId = useMemo(() => {
    const map = new Map<string, PricingBaseHistoryDbRow>();
    for (const row of pricingBaseHistoryRows) {
      if (!map.has(row.item_id)) {
        map.set(row.item_id, row);
      }
    }
    return map;
  }, [pricingBaseHistoryRows]);

  const baseRows = useMemo<BasePriceRow[]>(() => {
    return catalogItems.map((item) => {
      const base = basePricingByItemId.get(item.id);
      const latestHistory = latestHistoryByItemId.get(item.id);
      const previousBaseCost = latestHistory?.previous_base_cost ?? null;
      const currentBaseCost = base?.base_cost ?? 0;
      const costVariationPct =
        previousBaseCost !== null && previousBaseCost > 0
          ? ((currentBaseCost - previousBaseCost) / previousBaseCost) * 100
          : null;

      return {
        item_id: item.id,
        sku: item.sku,
        name: item.name,
        brand: item.brand,
        model: item.model,
        category: item.category,
        unit: item.unit,
        previous_base_cost: previousBaseCost,
        base_cost: currentBaseCost,
        cost_variation_pct: costVariationPct,
        updated_at: base?.updated_at ?? null,
        updated_by: base?.updated_by ?? null,
      };
    });
  }, [basePricingByItemId, catalogItems, latestHistoryByItemId]);

  const filteredBaseRows = useMemo(() => {
    const term = baseSearch.trim().toLowerCase();
    if (!term) return baseRows;

    return baseRows.filter((row) =>
      [row.sku, row.name, row.brand, row.model, row.category]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [baseRows, baseSearch]);

  const basePagination = usePaginationSlice({
    items: filteredBaseRows,
    page: basePage,
    pageSize: basePageSize,
  });

  const countsByListId = useMemo(() => {
    const map = new Map<string, { total: number; pending: number }>();
    for (const row of priceListCounts) {
      if (!row.is_active) continue;
      const entry = map.get(row.price_list_id) ?? { total: 0, pending: 0 };
      entry.total += 1;
      if (row.needs_recalculation) entry.pending += 1;
      map.set(row.price_list_id, entry);
    }
    return map;
  }, [priceListCounts]);

  const priceLists = useMemo<PriceListSummary[]>(() => {
    const term = listSearch.trim().toLowerCase();

    return priceListsRaw
      .map((row) => {
        const counts = countsByListId.get(row.id) ?? { total: 0, pending: 0 };
        return {
          ...row,
          status: row.status === "UPDATED" ? "UPDATED" : "PENDING",
          pending_items_count: counts.pending,
          total_items_count: counts.total,
        };
      })
      .filter((row) =>
        !term
          || row.name.toLowerCase().includes(term)
          || (row.description ?? "").toLowerCase().includes(term),
      );
  }, [countsByListId, listSearch, priceListsRaw]);

  const selectedList = useMemo(
    () => priceLists.find((priceList) => priceList.id === selectedListId) ?? null,
    [priceLists, selectedListId],
  );

  const selectedSnapshotsByItemId = useMemo(
    () => new Map(selectedListSnapshots.map((row) => [row.item_id, row])),
    [selectedListSnapshots],
  );

  const selectedListProducts = useMemo<PriceListProductRow[]>(() => {
    return baseRows.map((row) => {
      const snapshot = selectedSnapshotsByItemId.get(row.item_id);
      return {
        item_id: row.item_id,
        sku: row.sku,
        name: row.name,
        brand: row.brand,
        model: row.model,
        category: row.category,
        unit: row.unit,
        previous_base_cost: row.previous_base_cost,
        base_cost: row.base_cost,
        cost_variation_pct: row.cost_variation_pct,
        calculated_price: snapshot?.calculated_price ?? 0,
        needs_recalculation: snapshot?.needs_recalculation ?? true,
        last_calculated_at: snapshot?.last_calculated_at ?? null,
        last_calculated_by: snapshot?.last_calculated_by ?? null,
      };
    });
  }, [baseRows, selectedSnapshotsByItemId]);

  const filteredSelectedListProducts = useMemo(() => {
    const term = detailSearch.trim().toLowerCase();
    if (!term) return selectedListProducts;

    return selectedListProducts.filter((row) =>
      [row.sku, row.name, row.brand, row.model, row.category]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [detailSearch, selectedListProducts]);

  const detailPagination = usePaginationSlice({
    items: filteredSelectedListProducts,
    page: detailPage,
    pageSize: detailPageSize,
  });

  const updateBaseCostMutation = useMutation({
    mutationFn: async ({ baseCost, itemId }: { baseCost: number; itemId: string }) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa activa");
      const normalizedBaseCost = Math.max(0, baseCost);
      const previousBaseCost = basePricingByItemId.get(itemId)?.base_cost ?? 0;

      if (previousBaseCost !== normalizedBaseCost) {
        const { error: historyError } = await supabase
          .from("item_pricing_base_history")
          .insert({
            company_id: currentCompany.id,
            item_id: itemId,
            previous_base_cost: previousBaseCost,
            new_base_cost: normalizedBaseCost,
            changed_by: user?.id ?? null,
          });
        if (historyError) throw historyError;
      }

      const { error } = await supabase
        .from("item_pricing_base")
        .upsert({
          company_id: currentCompany.id,
          item_id: itemId,
          base_cost: normalizedBaseCost,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: async () => invalidatePricingQueries(queryClient),
    onError: (error: unknown) =>
      toast({ title: "No se pudo guardar el costo base", description: getErrorMessage(error), variant: "destructive" }),
  });

  const createListMutation = useMutation({
    mutationFn: async (form: PriceListFormState) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa activa");

      const { error } = await supabase.from("price_lists").insert({
        company_id: currentCompany.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        flete_pct: parseNonNegative(form.flete_pct, 0),
        utilidad_pct: parseNonNegative(form.utilidad_pct, 0),
        impuesto_pct: parseNonNegative(form.impuesto_pct, 0),
        round_mode: "none",
        round_to: 0.01,
        status: "PENDING",
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePricingQueries(queryClient);
      toast({ title: "Lista creada" });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo crear la lista", description: getErrorMessage(error), variant: "destructive" }),
  });

  const updateListConfigMutation = useMutation({
    mutationFn: async ({ form, priceListId }: { form: PriceListFormState; priceListId: string }) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa activa");

      const { error } = await supabase
        .from("price_lists")
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          flete_pct: parseNonNegative(form.flete_pct, 0),
          utilidad_pct: parseNonNegative(form.utilidad_pct, 0),
          impuesto_pct: parseNonNegative(form.impuesto_pct, 0),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("company_id", currentCompany.id)
        .eq("id", priceListId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePricingQueries(queryClient);
      toast({ title: "Configuración guardada" });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo guardar la configuración", description: getErrorMessage(error), variant: "destructive" }),
  });

  const recalculateMutation = useMutation({
    mutationFn: async (priceListId: string) => {
      const { data, error } = await supabase.rpc("recalculate_price_list", {
        p_price_list_id: priceListId,
        p_actor: user?.id ?? null,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (updatedCount) => {
      invalidatePricingQueries(queryClient);
      toast({ title: "Lista recalculada", description: `${updatedCount} productos actualizados.` });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo recalcular la lista", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteListMutation = useMutation({
    mutationFn: async (priceListId: string) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa activa");

      const { count, error: documentsError } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", currentCompany.id)
        .eq("price_list_id", priceListId);
      if (documentsError) throw documentsError;

      if ((count ?? 0) > 0) {
        throw new Error("No se puede eliminar porque la lista ya fue usada en documentos.");
      }

      const { error: historyError } = await supabase
        .from("price_list_history")
        .delete()
        .eq("company_id", currentCompany.id)
        .eq("price_list_id", priceListId);
      if (historyError) throw historyError;

      const { error: deleteError } = await supabase
        .from("price_lists")
        .delete()
        .eq("company_id", currentCompany.id)
        .eq("id", priceListId);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      invalidatePricingQueries(queryClient);
      toast({ title: "Lista eliminada" });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo eliminar la lista", description: getErrorMessage(error), variant: "destructive" }),
  });

  return {
    baseRows,
    pagedBaseRows: basePagination.pagedItems,
    priceLists,
    profileNameByUserId,
    selectedList,
    selectedListHistory,
    pagedSelectedListProducts: detailPagination.pagedItems,
    updateBaseCostMutation,
    createListMutation,
    updateListConfigMutation,
    recalculateMutation,
    deleteListMutation,
    basePagination: {
      page: basePagination.page,
      totalItems: filteredBaseRows.length,
      totalPages: basePagination.totalPages,
    },
    detailPagination: {
      page: detailPagination.page,
      totalItems: filteredSelectedListProducts.length,
      totalPages: detailPagination.totalPages,
    },
  };
}
