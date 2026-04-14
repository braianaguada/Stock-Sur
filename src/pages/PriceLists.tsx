import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { VisibilityState } from "@tanstack/react-table";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, RefreshCcw, Search } from "lucide-react";
import { BasePricesTable } from "@/features/price-lists/components/BasePricesTable";
import { PriceListCreateDialog } from "@/features/price-lists/components/PriceListCreateDialog";
import { PriceListDetailDialog } from "@/features/price-lists/components/PriceListDetailDialog";
import { DEFAULT_PRICE_LIST_FORM, PRICE_LIST_STATUS_LABEL } from "@/features/price-lists/constants";
import type { PriceListFormState } from "@/features/price-lists/types";
import { usePriceListsData } from "@/features/price-lists/use-price-lists-data";
import { formatDateTime } from "@/features/price-lists/utils";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;
const PRICE_LISTS_UI_STATE_KEY = "price-lists:ui-state";
const PRICE_BASE_COLUMNS_KEY = "price-lists:base-columns";
const PRICE_DETAIL_COLUMNS_KEY = "price-lists:detail-columns";
const DEFAULT_BASE_COLUMN_VISIBILITY: VisibilityState = {
  sku: true,
  name: true,
  stock: true,
  attributes: true,
  brand: true,
  model: true,
  category: true,
  previous_base_cost: true,
  base_cost: true,
  cost_variation_pct: true,
  updated_at: true,
  updated_by: true,
};
const DEFAULT_DETAIL_COLUMN_VISIBILITY: VisibilityState = {
  sku: true,
  name: true,
  attributes: true,
  calculated_price: true,
  needs_recalculation: true,
};
const BASE_COLUMN_OPTIONS: Array<{ id: keyof typeof DEFAULT_BASE_COLUMN_VISIBILITY; label: string }> = [
  { id: "sku", label: "SKU" },
  { id: "name", label: "Nombre" },
  { id: "stock", label: "Stock" },
  { id: "attributes", label: "Atributos" },
  { id: "brand", label: "Marca" },
  { id: "model", label: "Modelo" },
  { id: "category", label: "Categoría" },
  { id: "previous_base_cost", label: "Costo anterior" },
  { id: "base_cost", label: "Costo base" },
  { id: "cost_variation_pct", label: "Variación" },
  { id: "updated_at", label: "Última actualización" },
  { id: "updated_by", label: "Usuario" },
];

const pricingChipClass = {
  flete: "border-blue-200/80 bg-blue-50/90 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200",
  margen: "border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  iva: "border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
} as const;

export default function PriceListsPage() {
  const { currentCompany, user } = useAuth();
  const storageKey = currentCompany ? `${PRICE_LISTS_UI_STATE_KEY}:${currentCompany.id}` : null;
  const baseColumnsStorageKey = `${PRICE_BASE_COLUMNS_KEY}:${user?.id ?? "anonymous"}:${currentCompany?.id ?? "no-company"}`;
  const detailColumnsStorageKey = `${PRICE_DETAIL_COLUMNS_KEY}:${user?.id ?? "anonymous"}:${currentCompany?.id ?? "no-company"}`;

  const [moduleTab, setModuleTab] = useState("base");
  const [baseSearch, setBaseSearch] = useState("");
  const [basePage, setBasePage] = useState(1);
  const [basePageSize, setBasePageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [listSearch, setListSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("products");
  const [baseColumnsOpen, setBaseColumnsOpen] = useState(false);
  const [detailColumnsOpen, setDetailColumnsOpen] = useState(false);
  const [baseColumnVisibility, setBaseColumnVisibility] = useState<VisibilityState>(DEFAULT_BASE_COLUMN_VISIBILITY);
  const [detailColumnVisibility, setDetailColumnVisibility] = useState<VisibilityState>(DEFAULT_DETAIL_COLUMN_VISIBILITY);
  const [baseColumnsHydrated, setBaseColumnsHydrated] = useState(false);
  const [detailColumnsHydrated, setDetailColumnsHydrated] = useState(false);
  const [createForm, setCreateForm] = useState<PriceListFormState>(DEFAULT_PRICE_LIST_FORM);
  const [configDraft, setConfigDraft] = useState<PriceListFormState | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "no_stock">("all");

  const stockQuery = useQuery({
    queryKey: ["items-stock-totals", currentCompany?.id ?? null],
    enabled: Boolean(currentCompany),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("item_id, type, quantity")
        .eq("company_id", currentCompany!.id);
      if (error) throw error;

      const totals = new Map<string, number>();
      for (const row of data ?? []) {
        const prev = totals.get(row.item_id) ?? 0;
        const qty = Number(row.quantity);
        if (row.type === "IN") totals.set(row.item_id, prev + qty);
        else if (row.type === "OUT") totals.set(row.item_id, prev - qty);
        else totals.set(row.item_id, prev + qty);
      }
      return totals;
    },
  });

  const stockByItemId = useMemo(() => stockQuery.data ?? new Map<string, number>(), [stockQuery.data]);

  const {
    pagedBaseRows,
    priceLists,
    profileNameByUserId,
    selectedList,
    selectedListHistory,
    pagedSelectedListProducts,
    updateBaseCostMutation,
    createListMutation,
    updateListConfigMutation,
    recalculateMutation,
    deleteListMutation,
    basePagination,
    detailPagination,
  } = usePriceListsData({
    basePage,
    basePageSize,
    baseSearch,
    detailPage,
    detailPageSize,
    detailSearch,
    listSearch,
    selectedListId,
  });

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    const rawState = sessionStorage.getItem(storageKey);
    if (!rawState) return;

    try {
      const persistedState = JSON.parse(rawState) as {
        baseSearch?: string;
        listSearch?: string;
        moduleTab?: string;
      };

      setBaseSearch(persistedState.baseSearch ?? "");
      setListSearch(persistedState.listSearch ?? "");
      setModuleTab(persistedState.moduleTab === "lists" ? "lists" : "base");
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    sessionStorage.setItem(storageKey, JSON.stringify({
      moduleTab,
      baseSearch,
      listSearch,
    }));
  }, [baseSearch, listSearch, moduleTab, storageKey]);

  useEffect(() => {
    setBaseColumnsHydrated(false);
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(baseColumnsStorageKey);
    if (!raw) {
      setBaseColumnVisibility(DEFAULT_BASE_COLUMN_VISIBILITY);
      setBaseColumnsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as VisibilityState;
      setBaseColumnVisibility({
        ...DEFAULT_BASE_COLUMN_VISIBILITY,
        ...parsed,
      });
      setBaseColumnsHydrated(true);
    } catch {
      localStorage.removeItem(baseColumnsStorageKey);
      setBaseColumnVisibility(DEFAULT_BASE_COLUMN_VISIBILITY);
      setBaseColumnsHydrated(true);
    }
  }, [baseColumnsStorageKey]);

  useEffect(() => {
    setDetailColumnsHydrated(false);
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(detailColumnsStorageKey);
    if (!raw) {
      setDetailColumnVisibility(DEFAULT_DETAIL_COLUMN_VISIBILITY);
      setDetailColumnsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as VisibilityState;
      setDetailColumnVisibility({
        ...DEFAULT_DETAIL_COLUMN_VISIBILITY,
        ...parsed,
      });
      setDetailColumnsHydrated(true);
    } catch {
      localStorage.removeItem(detailColumnsStorageKey);
      setDetailColumnVisibility(DEFAULT_DETAIL_COLUMN_VISIBILITY);
      setDetailColumnsHydrated(true);
    }
  }, [detailColumnsStorageKey]);

  useEffect(() => {
    if (!baseColumnsHydrated || typeof window === "undefined") return;
    localStorage.setItem(baseColumnsStorageKey, JSON.stringify(baseColumnVisibility));
  }, [baseColumnVisibility, baseColumnsHydrated, baseColumnsStorageKey]);

  useEffect(() => {
    if (!detailColumnsHydrated || typeof window === "undefined") return;
    localStorage.setItem(detailColumnsStorageKey, JSON.stringify(detailColumnVisibility));
  }, [detailColumnVisibility, detailColumnsHydrated, detailColumnsStorageKey]);

  useEffect(() => {
    setBasePage(1);
  }, [baseSearch, basePageSize]);

  useEffect(() => {
    setDetailPage(1);
  }, [detailSearch, detailPageSize]);

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

  const openListDetail = (priceListId: string) => {
    setSelectedListId(priceListId);
    setDetailSearch("");
    setDetailPage(1);
    setDetailTab("products");
    setDetailDialogOpen(true);
  };

  const renderUserName = useCallback((userId: string | null) => {
    if (!userId) return "-";
    return profileNameByUserId.get(userId) ?? userId.slice(0, 8);
  }, [profileNameByUserId]);

  const handleSaveBaseCost = useCallback((itemId: string, nextBaseCost: number) => {
    updateBaseCostMutation.mutate({ itemId, baseCost: nextBaseCost });
  }, [updateBaseCostMutation]);

  const toggleBaseColumnVisibility = useCallback((columnId: keyof typeof DEFAULT_BASE_COLUMN_VISIBILITY, checked: boolean) => {
    setBaseColumnVisibility((current) => ({
      ...current,
      [columnId]: checked,
    }));
  }, []);

  const toggleDetailColumnVisibility = useCallback((columnId: string, checked: boolean) => {
    setDetailColumnVisibility((current) => ({
      ...current,
      [columnId]: checked,
    }));
  }, []);

  const renderPricingSummary = (values: {
    flete_pct: number | null;
    utilidad_pct: number | null;
    impuesto_pct: number | null;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" className={`px-2.5 py-0.5 text-[10px] ${pricingChipClass.flete}`}>
        Flete {values.flete_pct ?? 0}%
      </Badge>
      <Badge variant="outline" className={`px-2.5 py-0.5 text-[10px] ${pricingChipClass.margen}`}>
        Margen {values.utilidad_pct ?? 0}%
      </Badge>
      <Badge variant="outline" className={`px-2.5 py-0.5 text-[10px] ${pricingChipClass.iva}`}>
        IVA {values.impuesto_pct ?? 0}%
      </Badge>
    </div>
  );

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para gestionar precios base y listas." />
        ) : null}

        <PageHeader
          eyebrow="Pricing operativo"
          title="Precios"
          subtitle="Gestiona costos base y listas de precios derivadas con una lectura mas clara, manteniendo intactos calculos, recalculos e historial."
          tabs={[
            { label: "Precios base", value: "base" },
            { label: "Listas", value: "lists" },
          ]}
          activeTab={moduleTab}
          onTabChange={setModuleTab}
          actions={moduleTab === "lists" ? (
            <Button onClick={() => { setCreateForm(DEFAULT_PRICE_LIST_FORM); setCreateDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nueva lista
            </Button>
          ) : undefined}
        />

        <Tabs value={moduleTab} onValueChange={setModuleTab}>
          <TabsContent value="base" className="space-y-5 pt-1">
            <Collapsible open={baseColumnsOpen} onOpenChange={setBaseColumnsOpen}>
              <FilterBar>
                <div className="relative max-w-sm flex-1 min-w-[260px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por SKU, nombre, marca, modelo, atributos o categoria..."
                    className="pl-9"
                    value={baseSearch}
                    onChange={(event) => {
                      setBaseSearch(event.target.value);
                      setBasePage(1);
                    }}
                  />
                </div>
                <div className="w-full md:w-44">
                  <Select value={stockFilter} onValueChange={(value) => {
                    setStockFilter(value as "all" | "in_stock" | "no_stock");
                    setBasePage(1);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los stocks</SelectItem>
                      <SelectItem value="in_stock">Con stock</SelectItem>
                      <SelectItem value="no_stock">Sin stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" type="button">
                    Columnas
                  </Button>
                </CollapsibleTrigger>
              </FilterBar>
              <CollapsibleContent>
                <DataCard className="mt-3 space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Columnas visibles</h3>
                      <p className="text-sm text-muted-foreground">La preferencia se guarda por usuario.</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setBaseColumnVisibility(DEFAULT_BASE_COLUMN_VISIBILITY)}>
                      Restaurar
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {BASE_COLUMN_OPTIONS.map((column) => (
                      <label key={column.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={baseColumnVisibility[column.id] !== false}
                          onCheckedChange={(checked) => toggleBaseColumnVisibility(column.id, checked === true)}
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </DataCard>
              </CollapsibleContent>
            </Collapsible>
            <DataCard>
              <BasePricesTable
                rows={pagedBaseRows.filter(row => {
                  if (stockFilter === "all") return true;
                  const total = stockByItemId.get(row.item_id) ?? 0;
                  return stockFilter === "in_stock" ? total > 0 : total <= 0;
                })}
                isSaving={updateBaseCostMutation.isPending}
                pageSize={basePageSize}
                columnVisibility={baseColumnVisibility}
                stockByItemId={stockByItemId}
                renderUserName={renderUserName}
                onSaveDraftValue={handleSaveBaseCost}
              />
            </DataCard>
            <DataTablePagination
              page={basePagination.page}
              totalPages={basePagination.totalPages}
              totalItems={basePagination.totalItems}
              rangeStart={basePagination.totalItems === 0 ? 0 : (basePagination.page - 1) * basePageSize + 1}
              rangeEnd={Math.min(basePagination.page * basePageSize, basePagination.totalItems)}
              pageSize={basePageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setBasePage}
              onPageSizeChange={(value) => setBasePageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
              itemLabel="productos"
            />
          </TabsContent>

          <TabsContent value="lists" className="space-y-5 pt-1">
            <FilterBar>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar lista..."
                  className="pl-9"
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                />
              </div>
            </FilterBar>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {priceLists.length === 0 ? (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No hay listas de precios creadas.
                  </CardContent>
                </Card>
              ) : priceLists.map((priceList) => (
                <Card key={priceList.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{priceList.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{priceList.description || "Sin descripcion"}</p>
                      </div>
                      <Badge variant={priceList.status === "UPDATED" ? "default" : "secondary"}>
                        {PRICE_LIST_STATUS_LABEL[priceList.status]}
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/45 p-3">
                      {renderPricingSummary(priceList)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Productos</span>
                      <span className="text-right">{priceList.total_items_count}</span>
                      <span>Pendientes</span>
                      <span className="text-right">{priceList.pending_items_count}</span>
                      <span>Ult. recalculo</span>
                      <span className="text-right">{formatDateTime(priceList.last_recalculated_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => openListDetail(priceList.id)}>Ver lista</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedListId(priceList.id);
                          recalculateMutation.mutate(priceList.id);
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

      <PriceListCreateDialog
        open={createDialogOpen}
        form={createForm}
        isSaving={createListMutation.isPending}
        onOpenChange={setCreateDialogOpen}
        onFormChange={setCreateForm}
        onSubmit={() => createListMutation.mutate(createForm, {
          onSuccess: () => {
            setCreateDialogOpen(false);
            setCreateForm(DEFAULT_PRICE_LIST_FORM);
          },
        })}
      />

      <PriceListDetailDialog
        open={detailDialogOpen}
        selectedList={selectedList}
        selectedListHistory={selectedListHistory}
        pagedProducts={pagedSelectedListProducts}
        detailSearch={detailSearch}
        detailTab={detailTab}
        detailPage={detailPagination.page}
        detailTotalItems={detailPagination.totalItems}
        detailTotalPages={detailPagination.totalPages}
        productColumnsOpen={detailColumnsOpen}
        productColumnVisibility={detailColumnVisibility}
        configDraft={configDraft}
        isRecalculating={recalculateMutation.isPending}
        isSavingConfig={updateListConfigMutation.isPending}
        isDeleting={deleteListMutation.isPending}
        stockByItemId={stockByItemId}
        renderUserName={renderUserName}
        renderPricingSummary={renderPricingSummary}
        onOpenChange={setDetailDialogOpen}
        onDetailTabChange={setDetailTab}
        onDetailSearchChange={(value) => {
          setDetailSearch(value);
          setDetailPage(1);
        }}
        onDetailPageChange={setDetailPage}
        onProductColumnsOpenChange={setDetailColumnsOpen}
        onProductColumnVisibilityChange={toggleDetailColumnVisibility}
        onResetProductColumns={() => setDetailColumnVisibility(DEFAULT_DETAIL_COLUMN_VISIBILITY)}
        onConfigDraftChange={setConfigDraft}
        onSaveConfig={() => {
          if (!selectedListId || !configDraft) return;
          updateListConfigMutation.mutate({ form: configDraft, priceListId: selectedListId });
        }}
        onRecalculate={() => {
          if (!selectedListId) return;
          recalculateMutation.mutate(selectedListId);
        }}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar lista de precios"
        description={
          selectedList
            ? `Se eliminara la lista "${selectedList.name}". Si ya fue usada en documentos, el sistema no permitira borrarla.`
            : "Se eliminara la lista seleccionada."
        }
        confirmLabel="Eliminar lista"
        isPending={deleteListMutation.isPending}
        onConfirm={() => {
          if (!selectedListId) return;
          deleteListMutation.mutate(selectedListId, {
            onSuccess: () => {
              setDeleteDialogOpen(false);
              setDetailDialogOpen(false);
              setSelectedListId(null);
            },
          });
        }}
      />
    </AppLayout>
  );
}
