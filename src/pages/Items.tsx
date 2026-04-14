import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PackageX, Plus, Search } from "lucide-react";
import { cleanText, normalizeAlias } from "@/lib/clean";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { invalidateItemQueries, invalidateStockQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import { rankNaturalItemSearch, type ItemSearchAliasRecord } from "@/features/items/search";
import { type Item, type ItemAlias } from "@/features/items/types";
import { generateItemSku } from "@/features/items/utils";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { ItemFormDialog } from "@/features/items/components/ItemFormDialog";
import {
  ItemsDataTable,
  type ItemSortField,
  type SortDirection,
} from "@/features/items/components/ItemsDataTable";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;
const NEW_ITEM_DRAFT_KEY = "items:new-item-draft";
const ITEM_TABLE_COLUMNS_KEY = "items:table-columns";
const DEFAULT_ITEM_COLUMN_VISIBILITY: VisibilityState = {
  sku: true,
  name: true,
  stock: true,
  supplier: true,
  brand: true,
  model: true,
  attributes: false,
  category: true,
  unit: true,
  demand_profile: true,
  is_active: true,
  actions: true,
  select: true,
};
const ITEM_COLUMN_OPTIONS: Array<{ id: keyof typeof DEFAULT_ITEM_COLUMN_VISIBILITY; label: string; hideable?: boolean }> = [
  { id: "sku", label: "SKU" },
  { id: "name", label: "Nombre" },
  { id: "stock", label: "Stock" },
  { id: "supplier", label: "Proveedor" },
  { id: "brand", label: "Marca" },
  { id: "model", label: "Modelo" },
  { id: "attributes", label: "Atributos" },
  { id: "category", label: "Categoría" },
  { id: "unit", label: "Unidad" },
  { id: "demand_profile", label: "Demanda" },
  { id: "is_active", label: "Estado" },
];

function getNullableSortValue(item: Item, sortBy: ItemSortField) {
  switch (sortBy) {
    case "sku":
      return item.sku;
    case "name":
      return item.name;
    case "supplier":
      return item.supplier;
    case "brand":
      return item.brand;
    case "model":
      return item.model;
    case "attributes":
      return item.attributes;
    case "category":
      return item.category;
    default:
      return null;
  }
}

function sortItemsByStock(items: Item[], stockByItemId: Map<string, number>, direction: "asc" | "desc") {
  return [...items].sort((a, b) => {
    const aStock = stockByItemId.get(a.id) ?? -1;
    const bStock = stockByItemId.get(b.id) ?? -1;
    return direction === "asc" ? aStock - bStock : bStock - aStock;
  });
}

function compareItemValues(left: Item, right: Item, sortBy: ItemSortField) {
  const getStringValue = (value: string | null | undefined) => cleanText(value ?? "").toLocaleLowerCase("es");
  const compareNullableStrings = (leftValue: string | null | undefined, rightValue: string | null | undefined) => {
    return getStringValue(leftValue).localeCompare(getStringValue(rightValue), "es");
  };

  switch (sortBy) {
    case "sku":
      return compareNullableStrings(left.sku, right.sku);
    case "name":
      return compareNullableStrings(left.name, right.name);
    case "supplier":
      return compareNullableStrings(left.supplier, right.supplier);
    case "brand":
      return compareNullableStrings(left.brand, right.brand);
    case "model":
      return compareNullableStrings(left.model, right.model);
    case "attributes":
      return compareNullableStrings(left.attributes, right.attributes);
    case "category":
      return compareNullableStrings(left.category, right.category);
    case "is_active":
      return Number(left.is_active) - Number(right.is_active);
    case "created_at":
    default:
      return compareNullableStrings(left.name, right.name);
  }
}

function sortItems(items: Item[], sortBy: ItemSortField, sortDirection: SortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftNullableValue = getNullableSortValue(left, sortBy);
    const rightNullableValue = getNullableSortValue(right, sortBy);
    const leftEmpty = typeof leftNullableValue === "string" ? cleanText(leftNullableValue).length === 0 : leftNullableValue == null;
    const rightEmpty = typeof rightNullableValue === "string" ? cleanText(rightNullableValue).length === 0 : rightNullableValue == null;

    if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;

    const primary = compareItemValues(left, right, sortBy) * direction;
    if (primary !== 0) return primary;
    return left.name.localeCompare(right.name, "es");
  });
}

export default function ItemsPage() {
  const { currentCompany, user } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "no_stock">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [aliasToDelete, setAliasToDelete] = useState<ItemAlias | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [sortBy, setSortBy] = useState<ItemSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_ITEM_COLUMN_VISIBILITY);
  const [columnsHydrated, setColumnsHydrated] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    supplier: "",
    brand: "",
    model: "",
    attributes: "",
    unit: "un",
    category: "",
    demand_profile: "LOW" as Item["demand_profile"],
    demand_monthly_estimate: "",
  });
  const [newAlias, setNewAlias] = useState("");
  const [isSupplierCode, setIsSupplierCode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkDemandProfile, setBulkDemandProfile] = useState<Item["demand_profile"]>("LOW");
  const { toast } = useToast();
  const qc = useQueryClient();
  const aliasQueryKey = queryKeys.items.aliases(currentCompany?.id ?? null, editingItem?.id);
  const itemTableColumnsStorageKey = `${ITEM_TABLE_COLUMNS_KEY}:${user?.id ?? "anonymous"}:${currentCompany?.id ?? "no-company"}`;

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, categoryFilter, statusFilter, pageSize, sortBy, sortDirection]);

  useEffect(() => {
    if (!currentCompany || editingItem) return;
    const raw = sessionStorage.getItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { open?: boolean; form?: typeof form };
      if (draft.form) setForm(draft.form);
      if (draft.open) setDialogOpen(true);
    } catch {
      sessionStorage.removeItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
    }
  }, [currentCompany, editingItem]);

  useEffect(() => {
    if (!currentCompany || editingItem) return;
    if (!dialogOpen) return;
    sessionStorage.setItem(
      `${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`,
      JSON.stringify({ open: true, form }),
    );
  }, [currentCompany, dialogOpen, editingItem, form]);

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

  const itemsQuery = useQuery({
    queryKey: queryKeys.items.catalog(currentCompany?.id ?? null, categoryFilter, statusFilter),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      let q = supabase
        .from("items")
        .select("*")
        .eq("company_id", currentCompany!.id);
      if (statusFilter === "active") q = q.eq("is_active", true);
      if (statusFilter === "inactive") q = q.eq("is_active", false);

      if (categoryFilter !== "all") {
        q = q.eq("category", categoryFilter);
      }

      const { data, error } = await q.order("name", {
        ascending: true,
        nullsFirst: false,
      });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  // Fetch stock totals per item from stock_movements
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

  const stockStats = useMemo(() => {
    const all = itemsQuery.data ?? [];
    const stats = {
      total: all.length,
      active: all.filter(i => i.is_active).length,
      noStock: 0,
      inStock: 0,
    };
    all.forEach(item => {
      if (!item.is_active) return;
      const s = stockByItemId.get(item.id) ?? 0;
      if (s <= 0) stats.noStock++;
      else stats.inStock++;
    });
    return stats;
  }, [itemsQuery.data, stockByItemId]);

  const hasActiveSearch = deferredSearch.trim().length > 0;
  const aliasesSearchQuery = useQuery({
    queryKey: queryKeys.items.searchAliases(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany) && hasActiveSearch,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_aliases")
        .select("item_id, alias, is_supplier_code")
        .eq("company_id", currentCompany!.id);
      if (error) throw error;
      return (data ?? []) as ItemSearchAliasRecord[];
    },
  });

  const items = useMemo(() => {
    const allItems = itemsQuery.data ?? [];
    const searchTerm = deferredSearch.trim();
    const baseItems = searchTerm
      ? rankNaturalItemSearch({
        items: allItems,
        aliases: aliasesSearchQuery.data ?? [],
        query: searchTerm,
      })
      : allItems;

    let sorted = sortBy === "stock"
      ? sortItemsByStock(baseItems, stockByItemId, sortDirection)
      : sortItems(baseItems, sortBy, sortDirection);

    // Apply supplier filter
    if (supplierFilter !== "all") {
      sorted = sorted.filter((item) => (item.supplier ?? "") === supplierFilter);
    }

    // Apply stock filter
    if (stockFilter === "no_stock") {
      sorted = sorted.filter((item) => {
        const s = stockByItemId.get(item.id);
        return s === undefined || s <= 0;
      });
    } else if (stockFilter === "in_stock") {
      sorted = sorted.filter((item) => {
        const s = stockByItemId.get(item.id);
        return s !== undefined && s > 0;
      });
    }

    return sorted;
  }, [aliasesSearchQuery.data, deferredSearch, itemsQuery.data, sortBy, sortDirection, stockByItemId, supplierFilter, stockFilter]);

  const totalItems = items.length;
  const paginatedItems = useMemo(() => {
    const from = (page - 1) * pageSize;
    return items.slice(from, from + pageSize);
  }, [items, page, pageSize]);
  const isSearchSyncing = search.trim() !== deferredSearch.trim();
  const shouldHideResults = isSearchSyncing || itemsQuery.isLoading || (hasActiveSearch && aliasesSearchQuery.isLoading);
  const visibleItems = shouldHideResults ? [] : paginatedItems;
  const visibleTotalItems = shouldHideResults ? 0 : totalItems;
  const visibleTotalPages = Math.max(1, Math.ceil(visibleTotalItems / pageSize));
  const isLoading = shouldHideResults;

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.items.categories(currentCompany?.id ?? null, statusFilter),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      let q = supabase.from("items").select("category").eq("company_id", currentCompany!.id).not("category", "is", null);
      if (statusFilter === "active") q = q.eq("is_active", true);
      if (statusFilter === "inactive") q = q.eq("is_active", false);
      const { data, error } = await q;
      if (error) throw error;

      return Array.from(new Set((data ?? []).map((item) => item.category).filter(Boolean))) as string[];
    },
  });

  // Unique supplier list derived from current filtered-less item list
  const suppliers = useMemo(() => {
    const all = itemsQuery.data ?? [];
    return Array.from(new Set(all.map((i) => i.supplier).filter(Boolean))) as string[];
  }, [itemsQuery.data]);

  const { data: aliases = [] } = useQuery({
    queryKey: aliasQueryKey,
    enabled: !!editingItem && Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_aliases")
        .select("*")
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
      const sku = cleanText(form.sku).toUpperCase();
      const supplier = cleanText(form.supplier) || null;
      const brand = cleanText(form.brand) || null;
      const model = cleanText(form.model) || null;
      const attributes = cleanText(form.attributes) || null;
      const unit = cleanText(form.unit) || "un";

      if (!name) {
        throw new Error("Nombre obligatorio");
      }

      const monthlyEstimate = form.demand_monthly_estimate.trim() === "" ? null : Number(form.demand_monthly_estimate);
      const payload = {
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
            sku: sku || generateItemSku(name),
            is_active: true,
          })
          .select("*")
          .single();
        if (error) throw error;
        return data as Item;
      }
    },
    onSuccess: async (savedItem) => {
      if (currentCompany) {
        const currentCatalogKey = queryKeys.items.catalog(currentCompany.id, categoryFilter, statusFilter);
        qc.setQueryData<Item[]>(currentCatalogKey, (current = []) => {
          const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && savedItem.is_active) ||
            (statusFilter === "inactive" && !savedItem.is_active);
          const matchesCategory = categoryFilter === "all" || savedItem.category === categoryFilter;
          const shouldInclude = matchesStatus && matchesCategory;
          const withoutSavedItem = current.filter((item) => item.id !== savedItem.id);

          if (!shouldInclude) return withoutSavedItem;
          return sortItems([...withoutSavedItem, savedItem], sortBy, sortDirection);
        });
      }

      await Promise.all([invalidateItemQueries(qc), invalidateStockQueries(qc)]);
      if (currentCompany && !editingItem) {
        sessionStorage.removeItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
      }
      setDialogOpen(false);
      setEditingItem(null);
      setNewAlias("");
      setIsSupplierCode(false);
      toast({ title: editingItem ? "Ítem actualizado" : "Ítem creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar ítems");
      await deleteByStrategy({ table: "items", id, eq: { company_id: currentCompany.id } });
      const { error } = await supabase.from("price_list_items").update({ is_active: false }).eq("item_id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateItemQueries(qc),
        invalidateStockQueries(qc),
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
        .insert({ company_id: currentCompany!.id, item_id: editingItem.id, alias, is_supplier_code: isSupplierCode })
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
    onMutate: async () => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: queryKeys.items.all() });
      const previousItems = qc.getQueryData(queryKeys.items.all());
      
      qc.setQueryData(queryKeys.items.all(), (old: Item[] | undefined) => {
        if (!old) return old;
        return old.map((item: Item) => 
          selectedItemIds.includes(item.id) 
            ? { ...item, demand_profile: bulkDemandProfile } 
            : item
        );
      });

      return { previousItems };
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateItemQueries(qc),
        invalidateStockQueries(qc),
      ]);
      setSelectedItemIds([]);
      toast({ title: "Tipo de demanda actualizado" });
    },
    onError: (e: Error, _, context) => {
      const ctx = context as { previousItems?: Item[] } | undefined;
      if (ctx?.previousItems) {
        qc.setQueryData(queryKeys.items.all(), ctx.previousItems);
      }
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const bulkDeactivateNoStockMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa");
      // Filter only selected items that have stock <= 0 or not registered
      const toDeactivate = selectedItemIds.filter((id) => {
        const s = stockByItemId.get(id);
        return s === undefined || s <= 0;
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
    return s === undefined || s <= 0;
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
    if (currentCompany) {
      sessionStorage.removeItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
    }
    setEditingItem(null);
    setNewAlias("");
    setIsSupplierCode(false);
    setForm({
      sku: "",
      name: "",
      supplier: "",
      brand: "",
      model: "",
      attributes: "",
      unit: "un",
      category: "",
      demand_profile: "LOW",
      demand_monthly_estimate: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    if (currentCompany) {
      sessionStorage.removeItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
    }
    setEditingItem(item);
    setNewAlias("");
    setIsSupplierCode(false);
    setForm({
      sku: item.sku ?? "",
      name: item.name,
      supplier: item.supplier ?? "",
      brand: item.brand ?? "",
      model: item.model ?? "",
      attributes: item.attributes ?? "",
      unit: item.unit || "un",
      category: item.category ?? "",
      demand_profile: item.demand_profile ?? "LOW",
      demand_monthly_estimate: item.demand_monthly_estimate?.toString() ?? "",
    });
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
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitás una empresa activa para gestionar artículos, alias y catálogos de stock." />
        ) : null}
        <PageHeader
          eyebrow="Catálogo maestro"
          title="Ítems"
          subtitle="Gestioná productos, perfil de demanda y disponibilidad real en una vista integrada."
          actions={(
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo ítem
            </Button>
          )}
          meta={(
            <div className="flex gap-2">
              <Badge variant="outline">{stockStats.total} registrados</Badge>
              {selectedItemIds.length > 0 && <Badge variant="secondary">{selectedItemIds.length} seleccionados</Badge>}
            </div>
          )}
        />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-sm transition-all hover:shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Ítems</span>
            <span className="text-xl font-black">{stockStats.total}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-sm transition-all hover:shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Activos en Venta</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stockStats.active}</span>
          </div>
          <div 
            className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-sm transition-all hover:bg-card hover:shadow-md"
            onClick={() => setStockFilter("in_stock")}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Con Stock</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{stockStats.inStock}</span>
          </div>
          <div 
            className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-sm transition-all hover:bg-card hover:shadow-md"
            onClick={() => setStockFilter("no_stock")}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Sin Stock</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">{stockStats.noStock}</span>
          </div>
        </div>

        <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen}>
          <FilterBar>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU, nombre, marca, modelo, atributos, alias..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-44">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "active" | "inactive" | "all")}>
                <SelectTrigger>
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
            <div className="w-full md:w-52">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
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
                  <SelectTrigger>
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
          </FilterBar>
          <CollapsibleContent>
            <DataCard className="mt-3 space-y-3 p-4">
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
            </DataCard>
          </CollapsibleContent>
        </Collapsible>

        <DataCard>
          <ItemsDataTable
            items={visibleItems}
            isLoading={isLoading}
            pageSize={pageSize}
            selectedItemIds={selectedItemIds}
            columnVisibility={columnVisibility}
            sortBy={sortBy}
            sortDirection={sortDirection}
            stockByItemId={stockByItemId}
            onSort={toggleSort}
            onSelectionChange={setSelectedItemIds}
            onEdit={openEdit}
            onDelete={setItemToDelete}
            onRestore={(itemId) => restoreMutation.mutate(itemId)}
          />
        </DataCard>
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
      </div>

      <ItemFormDialog
        open={dialogOpen}
        editingItem={editingItem}
        form={form}
        aliases={aliases}
        newAlias={newAlias}
        isSupplierCode={isSupplierCode}
        isSaving={saveMutation.isPending}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && currentCompany && !editingItem) {
            sessionStorage.removeItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
          }
        }}
        onSubmit={() => saveMutation.mutate()}
        onFormChange={setForm}
        onGenerateSku={() => setForm((prev) => ({ ...prev, sku: generateItemSku(prev.name || "item") }))}
        onNewAliasChange={setNewAlias}
        onSupplierCodeChange={setIsSupplierCode}
        onAddAlias={addAlias}
        onDeleteAlias={setAliasToDelete}
      />

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



