import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, RefreshCcw, Search } from "lucide-react";
import { DEFAULT_PRICE_LIST_FORM, PRICE_LIST_STATUS_LABEL } from "@/features/price-lists/constants";
import type {
  BasePriceRow,
  PriceListFormState,
  PriceListHistoryRow,
  PriceListProductRow,
  PriceListSummary,
} from "@/features/price-lists/types";
import { formatDateTime, formatMoney, formatPercentDelta, parseNonNegative, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";
import { getErrorMessage } from "@/lib/errors";

const BASE_PAGE_SIZE = 10;
const LIST_PRODUCTS_PAGE_SIZE = 10;

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

const pricingChipClass = {
  flete: "border-blue-200 bg-blue-50 text-blue-700",
  margen: "border-emerald-200 bg-emerald-50 text-emerald-700",
  iva: "border-amber-200 bg-amber-50 text-amber-700",
} as const;

export default function PriceListsPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [moduleTab, setModuleTab] = useState("base");
  const [baseSearch, setBaseSearch] = useState("");
  const [basePage, setBasePage] = useState(1);
  const [listSearch, setListSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("products");
  const [createForm, setCreateForm] = useState<PriceListFormState>(DEFAULT_PRICE_LIST_FORM);
  const [configDraft, setConfigDraft] = useState<PriceListFormState | null>(null);
  const [baseCostDrafts, setBaseCostDrafts] = useState<Record<string, string>>({});

  const { data: catalogItems = [] } = useQuery({
    queryKey: ["pricing-catalog-items", currentCompany?.id ?? "no-company"],
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
    queryKey: ["pricing-base", currentCompany?.id ?? "no-company"],
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
    queryKey: ["pricing-base-history", currentCompany?.id ?? "no-company"],
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
    queryKey: ["price-lists-v2", currentCompany?.id ?? "no-company"],
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
    queryKey: ["price-list-counts", currentCompany?.id ?? "no-company"],
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
    queryKey: ["price-list-products-v2", currentCompany?.id ?? "no-company", selectedListId],
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
    queryKey: ["price-list-history", currentCompany?.id ?? "no-company", selectedListId],
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
  }, [pricingBaseRows, pricingBaseHistoryRows, priceListsRaw, selectedListSnapshots, selectedListHistory]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["pricing-user-profiles", userIds],
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
  }, [catalogItems, basePricingByItemId, latestHistoryByItemId]);

  useEffect(() => {
    setBaseCostDrafts(
      Object.fromEntries(baseRows.map((row) => [row.item_id, String(row.base_cost ?? 0)])),
    );
  }, [baseRows]);

  const filteredBaseRows = useMemo(() => {
    const term = baseSearch.trim().toLowerCase();
    if (!term) return baseRows;
    return baseRows.filter((row) =>
      [row.sku, row.name, row.brand, row.model, row.category]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [baseRows, baseSearch]);

  const baseTotalPages = Math.max(1, Math.ceil(filteredBaseRows.length / BASE_PAGE_SIZE));
  const safeBasePage = Math.min(basePage, baseTotalPages);
  const pagedBaseRows = useMemo(() => {
    const start = (safeBasePage - 1) * BASE_PAGE_SIZE;
    return filteredBaseRows.slice(start, start + BASE_PAGE_SIZE);
  }, [filteredBaseRows, safeBasePage]);

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

  useEffect(() => {
    if (!selectedList) {
      setConfigDraft(null);
      return;
    }
    setConfigDraft({
      name: selectedList.name,
      description: selectedList.description ?? "",
      flete_pct: String(selectedList.flete_pct ?? 0),
      utilidad_pct: String(selectedList.utilidad_pct ?? 0),
      impuesto_pct: String(selectedList.impuesto_pct ?? 0),
    });
  }, [selectedList]);

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

  const detailTotalPages = Math.max(1, Math.ceil(filteredSelectedListProducts.length / LIST_PRODUCTS_PAGE_SIZE));
  const safeDetailPage = Math.min(detailPage, detailTotalPages);
  const pagedSelectedListProducts = useMemo(() => {
    const start = (safeDetailPage - 1) * LIST_PRODUCTS_PAGE_SIZE;
    return filteredSelectedListProducts.slice(start, start + LIST_PRODUCTS_PAGE_SIZE);
  }, [filteredSelectedListProducts, safeDetailPage]);

  const updateBaseCostMutation = useMutation({
    mutationFn: async ({ itemId, baseCost }: { itemId: string; baseCost: number }) => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-base"] });
      qc.invalidateQueries({ queryKey: ["pricing-base-history"] });
      qc.invalidateQueries({ queryKey: ["price-list-counts"] });
      qc.invalidateQueries({ queryKey: ["price-lists-v2"] });
      qc.invalidateQueries({ queryKey: ["price-list-products-v2"] });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo guardar el costo base", description: getErrorMessage(error), variant: "destructive" }),
  });

  const createListMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa activa");
      const { error } = await supabase.from("price_lists").insert({
        company_id: currentCompany.id,
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        flete_pct: parseNonNegative(createForm.flete_pct, 0),
        utilidad_pct: parseNonNegative(createForm.utilidad_pct, 0),
        impuesto_pct: parseNonNegative(createForm.impuesto_pct, 0),
        round_mode: "none",
        round_to: 0.01,
        status: "PENDING",
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-lists-v2"] });
      qc.invalidateQueries({ queryKey: ["price-list-counts"] });
      setCreateDialogOpen(false);
      setCreateForm(DEFAULT_PRICE_LIST_FORM);
      toast({ title: "Lista creada" });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo crear la lista", description: getErrorMessage(error), variant: "destructive" }),
  });

  const updateListConfigMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany || !selectedListId || !configDraft) throw new Error("Seleccioná una lista");
      const { error } = await supabase
        .from("price_lists")
        .update({
          name: configDraft.name.trim(),
          description: configDraft.description.trim() || null,
          flete_pct: parseNonNegative(configDraft.flete_pct, 0),
          utilidad_pct: parseNonNegative(configDraft.utilidad_pct, 0),
          impuesto_pct: parseNonNegative(configDraft.impuesto_pct, 0),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("company_id", currentCompany.id)
        .eq("id", selectedListId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-lists-v2"] });
      qc.invalidateQueries({ queryKey: ["price-list-counts"] });
      qc.invalidateQueries({ queryKey: ["price-list-history"] });
      qc.invalidateQueries({ queryKey: ["price-list-products-v2"] });
      toast({ title: "Configuración guardada" });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo guardar la configuración", description: getErrorMessage(error), variant: "destructive" }),
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId) throw new Error("Seleccioná una lista");
      const { data, error } = await supabase.rpc("recalculate_price_list", {
        p_price_list_id: selectedListId,
        p_actor: user?.id ?? null,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (updatedCount) => {
      qc.invalidateQueries({ queryKey: ["price-lists-v2"] });
      qc.invalidateQueries({ queryKey: ["price-list-counts"] });
      qc.invalidateQueries({ queryKey: ["price-list-products-v2"] });
      qc.invalidateQueries({ queryKey: ["price-list-history"] });
      qc.invalidateQueries({ queryKey: ["documents-price-list-items"] });
      toast({ title: "Lista recalculada", description: `${updatedCount} productos actualizados.` });
    },
    onError: (error: unknown) =>
      toast({ title: "No se pudo recalcular la lista", description: getErrorMessage(error), variant: "destructive" }),
  });

  const openListDetail = (priceListId: string) => {
    setSelectedListId(priceListId);
    setDetailSearch("");
    setDetailPage(1);
    setDetailTab("products");
    setDetailDialogOpen(true);
  };

  const renderUserName = (userId: string | null) => {
    if (!userId) return "-";
    return profileNameByUserId.get(userId) ?? userId.slice(0, 8);
  };

  const renderPricingSummary = (values: {
    flete_pct: number | null;
    utilidad_pct: number | null;
    impuesto_pct: number | null;
  }) => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className={pricingChipClass.flete}>
        Flete {values.flete_pct ?? 0}%
      </Badge>
      <Badge variant="outline" className={pricingChipClass.margen}>
        Margen {values.utilidad_pct ?? 0}%
      </Badge>
      <Badge variant="outline" className={pricingChipClass.iva}>
        IVA {values.impuesto_pct ?? 0}%
      </Badge>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitás una empresa activa para gestionar precios base y listas." />
        ) : null}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Precios</h1>
            <p className="text-muted-foreground">Gestioná costos base y listas de precios derivadas.</p>
          </div>
          {moduleTab === "lists" ? (
            <Button onClick={() => { setCreateForm(DEFAULT_PRICE_LIST_FORM); setCreateDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nueva lista
            </Button>
          ) : null}
        </div>

        <Tabs value={moduleTab} onValueChange={setModuleTab}>
          <TabsList>
            <TabsTrigger value="base">Precios base</TabsTrigger>
            <TabsTrigger value="lists">Listas</TabsTrigger>
          </TabsList>

          <TabsContent value="base" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU, nombre, marca, modelo o categoría..."
                className="pl-9"
                value={baseSearch}
                onChange={(event) => { setBaseSearch(event.target.value); setBasePage(1); }}
              />
            </div>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Costo anterior</TableHead>
                    <TableHead className="text-right">Costo base</TableHead>
                    <TableHead className="text-right">Variación</TableHead>
                    <TableHead>Última actualización</TableHead>
                    <TableHead>Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBaseRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        No hay productos para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : pagedBaseRows.map((row) => (
                    <TableRow key={row.item_id}>
                      <TableCell className="font-mono text-xs">{row.sku ?? "-"}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.brand ?? "-"}</TableCell>
                      <TableCell>{row.model ?? "-"}</TableCell>
                      <TableCell>{row.category ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        {row.previous_base_cost !== null ? `$${formatMoney(row.previous_base_cost)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="ml-auto w-28 text-right font-mono"
                          type="number"
                          min={0}
                          step="any"
                          value={baseCostDrafts[row.item_id] ?? "0"}
                          onChange={(event) =>
                            setBaseCostDrafts((prev) => ({
                              ...prev,
                              [row.item_id]: sanitizeNonNegativeDraft(event.target.value),
                            }))}
                          onBlur={() =>
                            updateBaseCostMutation.mutate({
                              itemId: row.item_id,
                              baseCost: parseNonNegative(baseCostDrafts[row.item_id] ?? "0", 0),
                            })}
                        />
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm ${
                          row.cost_variation_pct !== null && row.cost_variation_pct > 0
                            ? "text-rose-600"
                            : row.cost_variation_pct !== null && row.cost_variation_pct < 0
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {formatPercentDelta(row.cost_variation_pct)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.updated_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{renderUserName(row.updated_by)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(safeBasePage - 1) * BASE_PAGE_SIZE + (pagedBaseRows.length === 0 ? 0 : 1)}-
                {Math.min(safeBasePage * BASE_PAGE_SIZE, filteredBaseRows.length)} de {filteredBaseRows.length} productos
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setBasePage((prev) => Math.max(1, prev - 1))} disabled={safeBasePage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-24 text-center text-sm text-muted-foreground">Página {safeBasePage} de {baseTotalPages}</span>
                <Button type="button" variant="outline" size="icon" onClick={() => setBasePage((prev) => Math.min(baseTotalPages, prev + 1))} disabled={safeBasePage >= baseTotalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lists" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar lista..."
                className="pl-9"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {priceLists.length === 0 ? (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No hay listas de precios creadas.
                  </CardContent>
                </Card>
              ) : priceLists.map((priceList) => (
                <Card key={priceList.id}>
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{priceList.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{priceList.description || "Sin descripción"}</p>
                      </div>
                      <Badge variant={priceList.status === "UPDATED" ? "default" : "secondary"}>
                        {PRICE_LIST_STATUS_LABEL[priceList.status]}
                      </Badge>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      {renderPricingSummary(priceList)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Productos</span>
                      <span className="text-right">{priceList.total_items_count}</span>
                      <span>Pendientes</span>
                      <span className="text-right">{priceList.pending_items_count}</span>
                      <span>Últ. recálculo</span>
                      <span className="text-right">{formatDateTime(priceList.last_recalculated_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => openListDetail(priceList.id)}>Ver lista</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedListId(priceList.id);
                          recalculateMutation.mutate();
                        }}
                        disabled={recalculateMutation.isPending}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" /> Recalcular
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva lista</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); createListMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Flete %</Label>
                <Input type="number" min={0} step="any" value={createForm.flete_pct} onChange={(event) => setCreateForm((prev) => ({ ...prev, flete_pct: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Margen %</Label>
                <Input type="number" min={0} step="any" value={createForm.utilidad_pct} onChange={(event) => setCreateForm((prev) => ({ ...prev, utilidad_pct: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>IVA %</Label>
                <Input type="number" min={0} step="any" value={createForm.impuesto_pct} onChange={(event) => setCreateForm((prev) => ({ ...prev, impuesto_pct: event.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createListMutation.isPending}>
                {createListMutation.isPending ? "Guardando..." : "Crear lista"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-6xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedList?.name ?? "Detalle de lista"}</DialogTitle>
          </DialogHeader>
          {selectedList ? (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="products">Productos</TabsTrigger>
                <TabsTrigger value="config">Configuración</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderPricingSummary(selectedList)}
                      <Badge
                        variant="outline"
                        className={selectedList.status === "UPDATED"
                          ? "border-teal-200 bg-teal-50 text-teal-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"}
                      >
                        {PRICE_LIST_STATUS_LABEL[selectedList.status]}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      Último recálculo: {formatDateTime(selectedList.last_recalculated_at)} · {renderUserName(selectedList.last_recalculated_by)}
                    </div>
                  </div>
                  <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto..."
                    className="pl-9"
                    value={detailSearch}
                    onChange={(event) => { setDetailSearch(event.target.value); setDetailPage(1); }}
                  />
                </div>
                </div>
                <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                  <div className="min-h-0 flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Precio lista</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedSelectedListProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No hay productos para mostrar.
                          </TableCell>
                        </TableRow>
                      ) : pagedSelectedListProducts.map((row) => (
                        <TableRow key={row.item_id}>
                          <TableCell className="font-mono text-xs">{row.sku ?? "-"}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right font-mono">${formatMoney(row.calculated_price)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={row.needs_recalculation
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-teal-200 bg-teal-50 text-teal-700"}
                            >
                              {row.needs_recalculation ? "Pendiente" : "Actualizado"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                </div>
                <div className="shrink-0 border-t bg-background px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                    Mostrando {(safeDetailPage - 1) * LIST_PRODUCTS_PAGE_SIZE + (pagedSelectedListProducts.length === 0 ? 0 : 1)}-
                    {Math.min(safeDetailPage * LIST_PRODUCTS_PAGE_SIZE, filteredSelectedListProducts.length)} de {filteredSelectedListProducts.length} productos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => setDetailPage((prev) => Math.max(1, prev - 1))} disabled={safeDetailPage <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-24 text-center text-sm text-muted-foreground">Página {safeDetailPage} de {detailTotalPages}</span>
                    <Button type="button" variant="outline" size="icon" onClick={() => setDetailPage((prev) => Math.min(detailTotalPages, prev + 1))} disabled={safeDetailPage >= detailTotalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  </div>
                </div>
              </div>
              </TabsContent>

              <TabsContent value="config" className="mt-4 space-y-4 overflow-auto">
                {configDraft ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input value={configDraft.name} onChange={(event) => setConfigDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción</Label>
                      <Textarea value={configDraft.description} onChange={(event) => setConfigDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Flete %</Label>
                        <Input type="number" min={0} step="any" value={configDraft.flete_pct} onChange={(event) => setConfigDraft((prev) => (prev ? { ...prev, flete_pct: event.target.value } : prev))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Margen %</Label>
                        <Input type="number" min={0} step="any" value={configDraft.utilidad_pct} onChange={(event) => setConfigDraft((prev) => (prev ? { ...prev, utilidad_pct: event.target.value } : prev))} />
                      </div>
                      <div className="space-y-2">
                        <Label>IVA %</Label>
                        <Input type="number" min={0} step="any" value={configDraft.impuesto_pct} onChange={(event) => setConfigDraft((prev) => (prev ? { ...prev, impuesto_pct: event.target.value } : prev))} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Última actualización</p>
                        <p className="mt-1 text-sm">{formatDateTime(selectedList.updated_at)}</p>
                        <p className="text-sm text-muted-foreground">{renderUserName(selectedList.updated_by)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Último recálculo</p>
                        <p className="mt-1 text-sm">{formatDateTime(selectedList.last_recalculated_at)}</p>
                        <p className="text-sm text-muted-foreground">{renderUserName(selectedList.last_recalculated_by)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => updateListConfigMutation.mutate()} disabled={updateListConfigMutation.isPending}>
                        Guardar configuración
                      </Button>
                      <Button variant="outline" onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}>
                        <RefreshCcw className="mr-2 h-4 w-4" /> Recalcular pendientes
                      </Button>
                    </div>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="history" className="mt-4 space-y-3 overflow-auto">
                {selectedListHistory.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Todavía no hay historial para esta lista.
                    </CardContent>
                  </Card>
                ) : selectedListHistory.map((row) => (
                  <Card key={row.id}>
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {row.event_type === "LIST_CREATED" ? "Lista creada" : row.event_type === "RECALCULATED" ? "Lista recalculada" : "Configuración actualizada"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {row.affected_items_count} productos afectados
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{formatDateTime(row.created_at)}</p>
                        <p>{renderUserName(row.created_by)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
