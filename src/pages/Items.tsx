import { normalizeSaleUnit } from "@/lib/stock-quantity";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VisibilityState } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "@/hooks/useSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { Boxes, CircleDollarSign, PackageX, Plus, Search } from "lucide-react";
import { cleanText, normalizeAlias } from "@/lib/clean";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { invalidateItemQueries, invalidatePricingQueries, invalidateStockQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import { catalogPageKey, fetchCatalogPage } from "@/features/items/catalog-page";
import { type Item, type ItemAlias, type ItemOperationalMeta } from "@/features/items/types";
import { createItemForm, productDetailsPayload } from "@/features/items/form";
import { validateItemCode } from "@/features/items/utils";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { ItemFormDialog } from "@/features/items/components/ItemFormDialog";
import {
  ItemsDataTable,
  type ItemSortField,
  type SortDirection,
} from "@/features/items/components/ItemsDataTable";
import { getOperationalPrice } from "@/features/pricing/operational-price";
import { cn } from "@/lib/utils";
import { CountBadge, MetricCard, MetricGrid } from "@/components/common/VisualSystem";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;
const NEW_ITEM_DRAFT_KEY = "items:new-item-draft";
const ITEM_TABLE_COLUMNS_KEY = "items:table-columns";

const DEFAULT_ITEM_COLUMN_VISIBILITY: VisibilityState = {
  sku: true,
  name: true,
  stock: true,
  base_cost: true,
  margin_pct: true,
  supplier: false,
  brand: true,
  model: false,
  attributes: false,
  category: false,
  unit: true,
  demand_profile: false,
  actions: true,
  select: true,
};
const ITEM_COLUMN_OPTIONS: Array<{ id: keyof typeof DEFAULT_ITEM_COLUMN_VISIBILITY; label: string; hideable?: boolean }> = [
  { id: "sku", label: "SKU" },
  { id: "name", label: "Nombre" },
  { id: "stock", label: "Stock" },
  { id: "base_cost", label: "Costo base" },
  { id: "margin_pct", label: "Margen" },
  { id: "supplier", label: "Proveedor" },
  { id: "brand", label: "Marca" },
  { id: "model", label: "Modelo" },
  { id: "attributes", label: "Atributos" },
  { id: "category", label: "Categoría" },
  { id: "unit", label: "Unidad" },
  { id: "demand_profile", label: "Demanda" },
];

export default function ItemsPage() {
  const { currentCompany, user } = useAuth();
  const { settings: companySettings } = useCompanyBrand();
  const { search, deferredSearch, setSearch, trimmedSearch } = useSearch();
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "no_stock">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [duplicatingSourceSku, setDuplicatingSourceSku] = useState<string | null>(null);
  const [createdItem, setCreatedItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [aliasToDelete, setAliasToDelete] = useState<ItemAlias | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [sortBy, setSortBy] = useState<ItemSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_ITEM_COLUMN_VISIBILITY);
  const [columnsHydrated, setColumnsHydrated] = useState(false);
  const [draftHydratedKey, setDraftHydratedKey] = useState<string | null>(null);
  const [form, setForm] = useState(createItemForm);
  const [aliasSupplierId, setAliasSupplierId] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [isSupplierCode, setIsSupplierCode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkDemandProfile, setBulkDemandProfile] = useState<Item["demand_profile"]>("LOW");
  const { toast } = useToast();
  const qc = useQueryClient();
  const aliasQueryKey = queryKeys.items.aliases(currentCompany?.id ?? null, editingItem?.id);
  const newItemDraftStorageKey = currentCompany && user
    ? `${NEW_ITEM_DRAFT_KEY}:${user.id}:${currentCompany.id}`
    : null;
  const itemTableColumnsStorageKey = `${ITEM_TABLE_COLUMNS_KEY}:${user?.id ?? "anonymous"}:${currentCompany?.id ?? "no-company"}`;
  const priceRoundingConfig = useMemo(() => ({
    enabled: companySettings.price_rounding_enabled,
    increment: companySettings.price_rounding_increment,
  }), [companySettings.price_rounding_enabled, companySettings.price_rounding_increment]);

  useEffect(() => {
    setPage(1);
  }, [currentCompany?.id, trimmedSearch, categoryFilter, supplierFilter, statusFilter, stockFilter, pageSize, sortBy, sortDirection]);

  useEffect(() => {
    setDraftHydratedKey(null);
    setDialogOpen(false);
    setEditingItem(null);
    if (!newItemDraftStorageKey) return;
    const raw = sessionStorage.getItem(newItemDraftStorageKey);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as { open?: boolean; form?: typeof form };
        if (draft.form) setForm({ ...createItemForm(), ...draft.form });
        if (draft.open) setDialogOpen(true);
      } catch {
        sessionStorage.removeItem(newItemDraftStorageKey);
      }
    }
    setDraftHydratedKey(newItemDraftStorageKey);
  }, [newItemDraftStorageKey]);

  useEffect(() => {
    if (!newItemDraftStorageKey || draftHydratedKey !== newItemDraftStorageKey || editingItem) return;
    if (!dialogOpen) return;
    sessionStorage.setItem(
      newItemDraftStorageKey,
      JSON.stringify({ open: true, form }),
    );
  }, [dialogOpen, draftHydratedKey, editingItem, form, newItemDraftStorageKey]);

  useEffect(() => {
    setColumnsHydrated(false);
    const raw = localStorage.getItem(itemTableColumnsStorageKey);
    if (!raw) {
      setColumnVisibility(DEFAULT_ITEM_COLUMN_VISIBILITY);
      setColumnsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as VisibilityState;
      setColumnVisibility({
        ...DEFAULT_ITEM_COLUMN_VISIBILITY,
        ...parsed,
        actions: true,
        select: true,
      });
      setColumnsHydrated(true);
    } catch {
      localStorage.removeItem(itemTableColumnsStorageKey);
      setColumnVisibility(DEFAULT_ITEM_COLUMN_VISIBILITY);
      setColumnsHydrated(true);
    }
  }, [itemTableColumnsStorageKey]);

  useEffect(() => {
    if (!columnsHydrated) return;
    localStorage.setItem(itemTableColumnsStorageKey, JSON.stringify({
      ...columnVisibility,
      actions: true,
      select: true,
    }));
  }, [columnVisibility, columnsHydrated, itemTableColumnsStorageKey]);

  const catalogFilters = {
    search: trimmedSearch, status: statusFilter, category: categoryFilter,
    supplier: supplierFilter, stock: stockFilter, sort: sortBy, direction: sortDirection, page, pageSize,
  };
  const itemsQuery = useQuery({
    queryKey: catalogPageKey(currentCompany?.id ?? null, catalogFilters),
    enabled: Boolean(currentCompany),
    queryFn: () => fetchCatalogPage(currentCompany!.id, catalogFilters),
  });
  useEffect(() => {
    if (itemsQuery.data && itemsQuery.data.page !== page) setPage(itemsQuery.data.page);
  }, [itemsQuery.data, page]);
  useEffect(() => {
    setSelectedItemIds([]);
  }, [currentCompany?.id, page, pageSize, trimmedSearch, statusFilter, categoryFilter, supplierFilter, stockFilter]);
  const stockByItemId = useMemo(() => new Map((itemsQuery.data?.items ?? []).map(item => [item.id, item.stock])), [itemsQuery.data]);
  const operationalMetaByItemId = useMemo(() => {
    const map = new Map<string, ItemOperationalMeta>();
    for (const item of itemsQuery.data?.items ?? []) {
      const { operationalPrice: mainPrice } = getOperationalPrice(item.main_price_original, priceRoundingConfig);
      map.set(item.id, {
        stock: item.stock, base_cost: item.base_cost, main_price: mainPrice,
        main_price_original: item.main_price_original, main_price_list_name: item.main_price_list_name,
        margin_pct: item.base_cost && item.base_cost > 0 && mainPrice && mainPrice > 0
          ? ((mainPrice - item.base_cost) / mainPrice) * 100 : null,
      });
    }
    return map;
  }, [itemsQuery.data, priceRoundingConfig]);
  const stockStats = itemsQuery.data?.stats ?? { total: 0, active: 0, inStock: 0, noStock: 0 };

  const hasActiveFilters = search.trim().length > 0
    || statusFilter !== "active"
    || stockFilter !== "all"
    || categoryFilter !== "all"
    || supplierFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("active");
    setStockFilter("all");
    setCategoryFilter("all");
    setSupplierFilter("all");
  };

  const isSearchSyncing = search.trim() !== deferredSearch.trim();
  const shouldHideResults = isSearchSyncing || itemsQuery.isLoading;
  const visibleItems = shouldHideResults ? [] : itemsQuery.data?.items ?? [];
  const visibleTotalItems = shouldHideResults ? 0 : itemsQuery.data?.total ?? 0;
  const visibleTotalPages = Math.max(1, Math.ceil(visibleTotalItems / pageSize));
  const isLoading = shouldHideResults;
  const categories = itemsQuery.data?.categories ?? [];
  const suppliers = itemsQuery.data?.suppliers ?? [];

  const { data: aliases = [] } = useQuery({
    queryKey: aliasQueryKey,
    enabled: !!editingItem && Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_aliases")
        .select("id, company_id, item_id, alias, is_supplier_code, supplier_id, created_at")
        .eq("company_id", currentCompany!.id)
        .eq("item_id", editingItem!.id)
        .order("created_at");
      if (error) throw error;
      return data as ItemAlias[];
    },
  });
  const rangeStart = visibleTotalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, visibleTotalItems);

  const toggleSort = (field: ItemSortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDirection(field === "is_active" ? "desc" : "asc");
  };

  const toggleColumnVisibility = (columnId: keyof typeof DEFAULT_ITEM_COLUMN_VISIBILITY, checked: boolean) => {
    setColumnVisibility((current) => ({
      ...current,
      [columnId]: checked,
      actions: true,
      select: true,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar ítems");
      const name = cleanText(form.name);
      const sku = validateItemCode(form.sku);
      const supplier = cleanText(form.supplier) || null;
      const brand = cleanText(form.brand) || null;
      const model = cleanText(form.model) || null;
      const attributes = cleanText(form.attributes) || null;
      const unit = normalizeSaleUnit(form.unit) || "un";

      if (!name) {
        throw new Error("Nombre obligatorio");
      }
      if (
        duplicatingSourceSku !== null
        && sku !== "" && sku === cleanText(duplicatingSourceSku).toUpperCase()
      ) {
        throw new Error("Ingresá un SKU nuevo para duplicar el ítem");
      }

      const monthlyEstimate = form.demand_monthly_estimate.trim() === "" ? null : Number(form.demand_monthly_estimate);
      const payload = {
        ...productDetailsPayload(form),
        name,
        supplier,
        brand,
        model,
        attributes,
        unit,
        category: cleanText(form.category) || null,
        demand_profile: form.demand_profile,
        demand_monthly_estimate: Number.isFinite(monthlyEstimate) ? monthlyEstimate : null,
      };

      if (editingItem) {
        const { data, error } = await supabase
          .from("items")
          .update({
            ...payload,
            sku: sku || editingItem.sku,
          })
          .eq("company_id", currentCompany.id)
          .eq("id", editingItem.id)
          .select("*")
          .single();
        if (error) throw error;
        return data as Item;
      } else {
        const { data, error } = await supabase
          .from("items")
          .insert({
            company_id: currentCompany.id,
            ...payload,
            sku,
            is_active: true,
          })
          .select("*")
          .single();
        if (error) throw error;
        return data as Item;
      }
    },
    onSuccess: async (savedItem) => {
      const wasCreating = !editingItem;
      await Promise.all([invalidateItemQueries(qc), invalidateStockQueries(qc), invalidatePricingQueries(qc)]);
      if (newItemDraftStorageKey && !editingItem) {
        sessionStorage.removeItem(newItemDraftStorageKey);
      }
      setDialogOpen(false);
      setDuplicatingSourceSku(null);
      setEditingItem(null);
      setNewAlias("");
      setIsSupplierCode(false);
    setAliasSupplierId("");
      if (wasCreating) setCreatedItem(savedItem);
      toast({ title: editingItem ? "Ítem actualizado" : "Ítem creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar ítems");
      await deleteByStrategy({ table: "items", id, eq: { company_id: currentCompany.id } });
      const { error } = await supabase
        .from("price_list_items")
        .update({ is_active: false })
        .eq("company_id", currentCompany.id)
        .eq("item_id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateItemQueries(qc),
        invalidateStockQueries(qc),
        invalidatePricingQueries(qc),
      ]);
      toast({ title: "Ítem desactivado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar ítems");
      const { error } = await supabase.from("items").update({ is_active: true }).eq("company_id", currentCompany.id).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateItemQueries(qc);
      toast({ title: "Ítem reactivado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addAliasMutation = useMutation({
    mutationFn: async (alias: string) => {
      if (!editingItem) throw new Error("Seleccioná un ítem antes de agregar alias");

      const { data, error } = await supabase
        .from("item_aliases")
        .insert({ company_id: currentCompany!.id, item_id: editingItem.id, alias, is_supplier_code: isSupplierCode, supplier_id: isSupplierCode ? aliasSupplierId || null : null })
        .select("*")
        .single();
      if (error) throw error;
      return data as ItemAlias;
    },
    onSuccess: (createdAlias) => {
      qc.setQueryData<ItemAlias[]>(aliasQueryKey, (current = []) => [...current, createdAlias]);
      qc.invalidateQueries({ queryKey: aliasQueryKey });
      qc.invalidateQueries({ queryKey: queryKeys.items.all() });
      setNewAlias("");
      setIsSupplierCode(false);
    setAliasSupplierId("");
    },
    onError: (e: Error) => {
      const lowerMessage = e.message.toLowerCase();
      const duplicateAlias = lowerMessage.includes("duplicate") || lowerMessage.includes("unique");

      toast({
        title: duplicateAlias ? "Alias duplicado" : "Error",
        description: duplicateAlias ? "Ese alias ya existe. Probá con otro código." : e.message,
        variant: "destructive",
      });
    },
  });

  const bulkDemandProfileMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar ítems");
      if (selectedItemIds.length === 0) return;
      const { error } = await supabase
        .from("items")
        .update({ demand_profile: bulkDemandProfile })
        .eq("company_id", currentCompany.id)
        .in("id", selectedItemIds);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateItemQueries(qc);
      setSelectedItemIds([]);
      toast({ title: "Tipo de demanda actualizado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const bulkDeactivateNoStockMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa");
      // Filter only selected items that have stock <= 0 or not registered
      const toDeactivate = selectedItemIds.filter((id) => {
        const s = stockByItemId.get(id);
        return s !== undefined && s <= 0;
      });
      if (toDeactivate.length === 0) throw new Error("Ninguno de los seleccionados tiene stock = 0");
      const { error } = await supabase
        .from("items")
        .update({ is_active: false })
        .eq("company_id", currentCompany.id)
        .in("id", toDeactivate);
      if (error) throw error;
      return toDeactivate.length;
    },
    onSuccess: async (count) => {
      await Promise.all([
        invalidateItemQueries(qc),
        invalidateStockQueries(qc),
      ]);
      setSelectedItemIds([]);
      toast({ title: `${count} ítem(s) desactivados (sin stock)` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const noStockSelectedCount = selectedItemIds.filter((id) => {
    const s = stockByItemId.get(id);
    return s !== undefined && s <= 0;
  }).length;

  const deleteAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar alias");
      await deleteByStrategy({ table: "item_aliases", id, eq: { company_id: currentCompany.id } });
      return id;
    },
    onSuccess: (deletedAliasId) => {
      qc.setQueryData<ItemAlias[]>(aliasQueryKey, (current = []) => current.filter((alias) => alias.id !== deletedAliasId));
      qc.invalidateQueries({ queryKey: aliasQueryKey });
      qc.invalidateQueries({ queryKey: queryKeys.items.all() });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    if (newItemDraftStorageKey) {
      sessionStorage.removeItem(newItemDraftStorageKey);
    }
    setEditingItem(null);
    setDuplicatingSourceSku(null);
    setNewAlias("");
    setIsSupplierCode(false);
    setAliasSupplierId("");
    setForm(createItemForm());
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    if (newItemDraftStorageKey) {
      sessionStorage.removeItem(newItemDraftStorageKey);
    }
    setEditingItem(item);
    setDuplicatingSourceSku(null);
    setNewAlias("");
    setIsSupplierCode(false);
    setAliasSupplierId("");
    setForm(createItemForm(item));
    setDialogOpen(true);
  };

  const openDuplicate = (item: Item) => {
    if (newItemDraftStorageKey) {
      sessionStorage.removeItem(newItemDraftStorageKey);
    }
    setEditingItem(null);
    setDuplicatingSourceSku(item.sku ?? "");
    setNewAlias("");
    setIsSupplierCode(false);
    setAliasSupplierId("");
    setForm({ ...createItemForm(item), sku: "" });
    setDialogOpen(true);
  };

  const addAlias = () => {
    const alias = cleanText(newAlias);
    if (!alias) {
      toast({ title: "Alias vacío", variant: "destructive" });
      return;
    }

    const normalized = normalizeAlias(alias);
    const isDuplicate = aliases.some((existing) => normalizeAlias(existing.alias) === normalized);
    if (isDuplicate) {
      toast({ title: "Alias duplicado", description: "Ese alias ya existe para este ítem.", variant: "destructive" });
      return;
    }

    addAliasMutation.mutate(alias);
  };

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitás una empresa activa para gestionar artículos, alias y catálogos de stock." />
        ) : null}
        <PageHeader
          eyebrow="Catálogo maestro"
          title="Ítems"
          actions={(
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo ítem
            </Button>
          )}
          meta={(
            <div className="flex gap-2">
              <CountBadge>{stockStats.total} registrados</CountBadge>
              {selectedItemIds.length > 0 ? <CountBadge>{selectedItemIds.length} seleccionados</CountBadge> : null}
            </div>
          )}
        />

        <MetricGrid className="mb-6" columns={4}>
          <MetricCard label="Total ítems" value={stockStats.total} format="plain" />
          <MetricCard label="Activos en venta" value={stockStats.active} format="plain" tone="success" />
          <button
            type="button"
            className={cn(
              "h-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              stockFilter === "in_stock" && "ring-2 ring-info/50",
            )}
            onClick={() => setStockFilter("in_stock")}
            aria-pressed={stockFilter === "in_stock"}
          >
            <MetricCard label="Con stock" value={stockStats.inStock} format="plain" tone="info" />
          </button>
          <button
            type="button"
            className={cn(
              "h-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              stockFilter === "no_stock" && "ring-2 ring-destructive/50",
            )}
            onClick={() => setStockFilter("no_stock")}
            aria-pressed={stockFilter === "no_stock"}
          >
            <MetricCard label="Sin stock" value={stockStats.noStock} format="plain" tone="danger" />
          </button>
        </MetricGrid>

        <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen}>
          <FilterToolbar>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar ítems"
                placeholder="Buscar por SKU, nombre, marca, modelo, atributos, alias..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-44">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "active" | "inactive" | "all")}>
                <SelectTrigger aria-label="Filtrar por estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-44">
              <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as "all" | "in_stock" | "no_stock")}>
                <SelectTrigger aria-label="Filtrar por stock">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los stocks</SelectItem>
                  <SelectItem value="in_stock">Con stock</SelectItem>
                  <SelectItem value="no_stock">Sin stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-52">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger aria-label="Filtrar por categoría">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {suppliers.length > 0 ? (
              <div className="w-full md:w-52">
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger aria-label="Filtrar por proveedor">
                    <SelectValue placeholder="Proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proveedores</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : null}
            {selectedItemIds.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-full md:w-52">
                  <Select value={bulkDemandProfile} onValueChange={(value) => setBulkDemandProfile(value as Item["demand_profile"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Demanda masiva" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja rotación</SelectItem>
                      <SelectItem value="MEDIUM">Rotación media</SelectItem>
                      <SelectItem value="HIGH">Alta rotación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  disabled={bulkDemandProfileMutation.isPending}
                  onClick={() => bulkDemandProfileMutation.mutate()}
                >
                  Actualizar demanda ({selectedItemIds.length})
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={noStockSelectedCount === 0 || bulkDeactivateNoStockMutation.isPending}
                  onClick={() => bulkDeactivateNoStockMutation.mutate()}
                  title={`Desactivar sólo los ${noStockSelectedCount} seleccionados sin stock`}
                >
                  <PackageX className="mr-2 h-4 w-4" />
                  Desactivar sin stock ({noStockSelectedCount})
                </Button>
              </div>
            ) : null}
            <CollapsibleTrigger asChild>
              <Button variant="outline" type="button">
                Columnas
              </Button>
            </CollapsibleTrigger>
          </FilterToolbar>
          <CollapsibleContent>
            <Card className="mt-3 space-y-3 border-border/70 p-4 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Columnas visibles</h3>
                  <p className="text-sm text-muted-foreground">La preferencia se guarda por usuario.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColumnVisibility(DEFAULT_ITEM_COLUMN_VISIBILITY)}
                >
                  Restaurar
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ITEM_COLUMN_OPTIONS.map((column) => (
                  <label key={column.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={columnVisibility[column.id] !== false}
                      onCheckedChange={(checked) => toggleColumnVisibility(column.id, checked === true)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {itemsQuery.isError && (
          <div role="alert" className="flex items-center gap-3 text-destructive">
            <span>No se pudieron cargar los ?tems: {itemsQuery.error.message}</span>
            <Button variant="outline" onClick={() => itemsQuery.refetch()}>Reintentar</Button>
          </div>
        )}
        <Card className="min-w-0 border-border/70 shadow-none">
          <ItemsDataTable
            items={visibleItems}
            isLoading={isLoading}
            pageSize={pageSize}
            selectedItemIds={selectedItemIds}
            columnVisibility={columnVisibility}
            sortBy={sortBy}
            sortDirection={sortDirection}
            stockByItemId={stockByItemId}
            operationalMetaByItemId={operationalMetaByItemId}
            onSort={toggleSort}
            onSelectionChange={setSelectedItemIds}
            onEdit={openEdit}
            onDelete={setItemToDelete}
            onRestore={(itemId) => restoreMutation.mutate(itemId)}
            onDuplicate={openDuplicate}
          />
        </Card>
        <DataTablePagination
          page={page}
          totalPages={visibleTotalPages}
          totalItems={visibleTotalItems}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(value) => setPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
          itemLabel="ítems"
        />
      </PageContainer>

      <ItemFormDialog
        companyId={currentCompany?.id ?? ""}
        aliasSupplierId={aliasSupplierId}
        onAliasSupplierChange={setAliasSupplierId}
        open={dialogOpen}
        editingItem={editingItem}
        isDuplicating={duplicatingSourceSku !== null}
        form={form}
        aliases={aliases}
        newAlias={newAlias}
        isSupplierCode={isSupplierCode}
        isSaving={saveMutation.isPending}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDuplicatingSourceSku(null);
          if (!open && newItemDraftStorageKey && !editingItem) {
            sessionStorage.removeItem(newItemDraftStorageKey);
          }
        }}
        onSubmit={() => saveMutation.mutate()}
        onFormChange={setForm}
        onGenerateSku={() => setForm((prev) => ({ ...prev, sku: "" }))}
        onNewAliasChange={setNewAlias}
        onSupplierCodeChange={setIsSupplierCode}
        onAddAlias={addAlias}
        onDeleteAlias={setAliasToDelete}
      />

      <Dialog open={Boolean(createdItem)} onOpenChange={(open) => !open && setCreatedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar alta del producto</DialogTitle>
            <DialogDescription>
              {createdItem?.name} ya fue creado. Podés continuar con su costo base y stock inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-auto justify-start gap-3 py-4">
              <Link to={`/price-lists?tab=base&itemId=${encodeURIComponent(createdItem?.id ?? "")}&setup=1`} onClick={() => setCreatedItem(null)}>
                <CircleDollarSign className="h-5 w-5" />
                Comenzar: costo y stock
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-auto justify-start gap-3 py-4">
              <Link to={`/stock?tab=current&itemId=${encodeURIComponent(createdItem?.id ?? "")}&newMovement=1&setup=1`} onClick={() => setCreatedItem(null)}>
                <Boxes className="h-5 w-5" />
                Ir directo al stock
              </Link>
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreatedItem(null)}>Completar después</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open) setItemToDelete(null);
        }}
        title="Eliminar ítem"
        description={itemToDelete ? `Esta acción eliminará "${itemToDelete.name}" de forma permanente.` : ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!itemToDelete) return;
          deleteMutation.mutate(itemToDelete.id);
          setItemToDelete(null);
        }}
      />

      <ConfirmDeleteDialog
        open={!!aliasToDelete}
        onOpenChange={(open) => {
          if (!open) setAliasToDelete(null);
        }}
        title="Eliminar alias"
        description={aliasToDelete ? `Esta acción eliminará el alias "${aliasToDelete.alias}".` : ""}
        isPending={deleteAliasMutation.isPending}
        onConfirm={() => {
          if (!aliasToDelete) return;
          deleteAliasMutation.mutate(aliasToDelete.id);
          setAliasToDelete(null);
        }}
      />
    </AppLayout>
  );
}



