import { useDeferredValue, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { invalidatePricingQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import type {
  BasePriceRow,
  PriceListFormState,
  PriceListHistoryRow,
  PriceListProductRow,
  PriceListSnapshot,
  PriceListSummary,
} from "@/features/price-lists/types";
import { parseNonNegative } from "@/features/price-lists/utils";
import type { PriceRoundingConfig } from "@/features/pricing/rounding";
import type { summarizePriceListMargins } from "@/features/price-lists/margin";

type PricingPageRow = BasePriceRow & PriceListProductRow & { stock: number };
type PricingPage = { items: PricingPageRow[]; page: number; totalItems: number; totalPages: number };
type PricingMetrics = {
 counts: { price_list_id: string; total: number; pending: number }[];
 marginSummary: ReturnType<typeof summarizePriceListMargins> | null;
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

type UsePriceListsDataParams = {
  basePage: number;
  basePageSize: number;
  baseSearch: string;
  detailPage: number;
  detailPageSize: number;
  detailSearch: string;
  listSearch: string;
  selectedListId: string | null;
  stockFilter: "all" | "in_stock" | "no_stock";
  baseEnabled: boolean;
  detailEnabled: boolean;
  itemIdFromQuery: string | null;
  priceRoundingConfig: PriceRoundingConfig;
};

export function usePriceListsData({
  basePage,
  basePageSize,
  baseSearch,
  detailPage,
  detailPageSize,
  detailSearch,
  listSearch,
  selectedListId, stockFilter, baseEnabled, detailEnabled, itemIdFromQuery, priceRoundingConfig,
}: UsePriceListsDataParams) {
  const deferredBaseSearch = useDeferredValue(baseSearch);
  const deferredDetailSearch = useDeferredValue(detailSearch);
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const companyId = currentCompany?.id ?? null;
  const loadPage = async (listId: string | null, search: string, page: number, pageSize: number, stock: string) => {
    const { data, error } = await supabase.rpc("list_pricing_items_page", {
      p_company_id: companyId!, p_list_id: listId, p_search: search, p_page: page,
      p_page_size: pageSize, p_stock_filter: stock,
    });
    if (error) throw error;
    return data as unknown as PricingPage;
  };
  const baseQuery = useQuery({
    queryKey: [...queryKeys.pricing.base(companyId), deferredBaseSearch, basePage, basePageSize, stockFilter],
    enabled: Boolean(companyId && baseEnabled),
    queryFn: () => loadPage(null, deferredBaseSearch, basePage, basePageSize, stockFilter),
  });
  const detailQuery = useQuery({
    queryKey: [...queryKeys.pricing.listProducts(companyId, selectedListId), deferredDetailSearch, detailPage, detailPageSize],
    enabled: Boolean(companyId && selectedListId && detailEnabled),
    queryFn: () => loadPage(selectedListId, deferredDetailSearch, detailPage, detailPageSize, "all"),
  });
  const baseRows = useMemo(() => baseQuery.data?.items ?? [], [baseQuery.data]);
  const selectedListProducts = useMemo(() => detailQuery.data?.items ?? [], [detailQuery.data]);
  const itemIdentityQuery = useQuery({
    queryKey: ["pricing-item-identity", companyId, itemIdFromQuery],
    enabled: Boolean(companyId && itemIdFromQuery),
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id,sku").eq("company_id",companyId!).eq("id",itemIdFromQuery!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const stockByItemId = useMemo(() => new Map([...baseRows,...selectedListProducts].map(row => [row.item_id,Number(row.stock)])), [baseRows,selectedListProducts]);

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

  const metricsQuery = useQuery({
    queryKey: [...queryKeys.pricing.listCounts(companyId), detailEnabled ? selectedListId : null, priceRoundingConfig],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_price_list_metrics", {
        p_company_id: companyId!,p_list_id: detailEnabled ? selectedListId : null,
        p_round_enabled: Boolean(priceRoundingConfig.enabled),p_round_increment: priceRoundingConfig.increment ?? 0,
      });
      if (error) throw error;
      return data as unknown as PricingMetrics;
    },
  });

  const { data: allListSnapshots = [] } = useQuery({
    queryKey: ["price-list-items", companyId, itemIdFromQuery],
    enabled: Boolean(companyId && itemIdFromQuery),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("price_list_id, item_id, base_cost, calculated_price, final_price_override, manual_price_enabled, manual_price_note, manual_price_updated_at, manual_price_updated_by, needs_recalculation, last_calculated_at, last_calculated_by")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true)
        .eq("item_id", itemIdFromQuery!);
      if (error) throw error;
      return (data ?? []) as PriceListSnapshot[];
    },
  });

  const { data: selectedListHistory = [] } = useQuery({
    queryKey: queryKeys.pricing.listHistory(currentCompany?.id ?? null, selectedListId),
    enabled: Boolean(currentCompany && selectedListId && detailEnabled),
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
    for (const row of baseRows) if (row.updated_by) ids.add(row.updated_by);
    for (const row of priceListsRaw) {
      if (row.created_by) ids.add(row.created_by);
      if (row.updated_by) ids.add(row.updated_by);
      if (row.last_recalculated_by) ids.add(row.last_recalculated_by);
    }
    for (const row of selectedListProducts) if (row.last_calculated_by) ids.add(row.last_calculated_by);
    for (const row of selectedListHistory) if (row.created_by) ids.add(row.created_by);
    return Array.from(ids);
  }, [priceListsRaw, baseRows, selectedListHistory, selectedListProducts]);

  const { data: profiles = [] } = useQuery({
    queryKey: [...queryKeys.pricing.userProfiles(userIds), companyId],
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

  const countsByListId = useMemo(() => new Map((metricsQuery.data?.counts ?? []).map(row => [row.price_list_id,row])), [metricsQuery.data]);

  const allPriceLists = useMemo<PriceListSummary[]>(() => {
    return priceListsRaw
      .map((row) => {
        const counts = countsByListId.get(row.id) ?? { total: 0, pending: 0 };
        return {
          ...row,
          status: row.status === "UPDATED" ? "UPDATED" : "PENDING",
          pending_items_count: counts.pending,
          total_items_count: counts.total,
        };
      });
  }, [countsByListId, priceListsRaw]);

  const priceLists = useMemo<PriceListSummary[]>(() => {
    const term = listSearch.trim().toLowerCase();

    return allPriceLists
      .filter((row) =>
        !term
          || row.name.toLowerCase().includes(term)
          || (row.description ?? "").toLowerCase().includes(term),
      );
  }, [allPriceLists, listSearch]);

  const selectedList = useMemo(
    () => allPriceLists.find((priceList) => priceList.id === selectedListId) ?? null,
    [allPriceLists, selectedListId],
  );

  const snapshotsByListAndItemId = useMemo(() => {
    const map = new Map<string, Map<string, PriceListSnapshot>>();
    for (const row of allListSnapshots) {
      const listMap = map.get(row.price_list_id) ?? new Map<string, PriceListSnapshot>();
      listMap.set(row.item_id, row);
      map.set(row.price_list_id, listMap);
    }
    return map;
  }, [allListSnapshots]);

  const updateBaseCostMutation = useMutation({
    mutationFn: async ({ baseCost, itemId }: { baseCost: number; itemId: string }) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa activa");
      const normalizedBaseCost = Math.max(0, baseCost);

      const { error } = await supabase.rpc("update_item_base_cost", {
        p_company_id: currentCompany.id,
        p_item_id: itemId,
        p_base_cost: normalizedBaseCost,
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

  const updateProductOverrideMutation = useMutation({
    mutationFn: async ({
      itemId,
      priceListId,
      enabled,
      price,
    }: {
      itemId: string;
      priceListId: string;
      enabled: boolean;
      price: number | null;
    }) => {
      if (!currentCompany) throw new Error("Selecciona una empresa activa");
      if (enabled && (price === null || !Number.isFinite(price) || price < 0)) {
        throw new Error("El precio personalizado debe ser mayor o igual a 0");
      }

      const { error } = await supabase
        .from("price_list_items")
        .update({
          final_price_override: enabled ? price : null,
          manual_price_enabled: enabled,
          manual_price_note: null,
          manual_price_updated_at: new Date().toISOString(),
          manual_price_updated_by: user?.id ?? null,
        })
        .eq("company_id", currentCompany.id)
        .eq("price_list_id", priceListId)
        .eq("item_id", itemId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidatePricingQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents.priceListItemsAll() });
      toast({ title: "Precio personalizado guardado" });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo guardar el precio personalizado", description: getErrorMessage(error), variant: "destructive" }),
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
    pagedBaseRows: baseRows,
    allPriceLists,
    priceLists,
    profileNameByUserId,
    snapshotsByListAndItemId,
    selectedList,
    selectedListHistory,
    selectedListProducts,
    pagedSelectedListProducts: selectedListProducts,
    updateBaseCostMutation,
    createListMutation,
    updateListConfigMutation,
    recalculateMutation,
    updateProductOverrideMutation,
    deleteListMutation,
    itemIdentity: itemIdentityQuery.data,
    stockByItemId,
    marginSummary: metricsQuery.data?.marginSummary ?? null,
    baseQuery, detailQuery, metricsQuery,
    basePagination: { page: baseQuery.data?.page ?? basePage, totalItems: baseQuery.data?.totalItems ?? 0, totalPages: baseQuery.data?.totalPages ?? 1 },
    detailPagination: { page: detailQuery.data?.page ?? detailPage, totalItems: detailQuery.data?.totalItems ?? 0, totalPages: detailQuery.data?.totalPages ?? 1 },
  };
}
