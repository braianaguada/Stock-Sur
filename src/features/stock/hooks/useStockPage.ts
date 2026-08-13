import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { clearSessionDraft, useSessionDraft } from "@/hooks/use-session-draft";
import { invalidateStockQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import { isIntegerOnlyStockUnit } from "@/lib/stock-quantity";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { matchesNaturalItemSearch } from "@/features/items/search";
import {
  buildStockRows,
  type StockItemSource,
  type StockMovementSource,
} from "@/features/stock/stockRows";
import type {
  Movement,
  SearchableItem,
  StockMovementForm,
  StockRow,
} from "@/features/stock/types";

const NEW_STOCK_MOVEMENT_DRAFT_KEY = "stock:new-movement-draft";
const DEFAULT_STOCK_MOVEMENT_FORM: StockMovementForm = {
  item_id: "",
  type: "IN",
  adjustment_direction: "ADD",
  quantity: "",
  reference: "",
};

type StockMovementDraft = {
  open: boolean;
  form: StockMovementForm;
  itemSearch: string;
  selectedItem: SearchableItem | null;
};

export function sanitizeStockMovementItemSearch(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined - undefined" || trimmed === "Item sin nombre") return "";

  return trimmed
    .replace(/^undefined\s*-\s*/i, "")
    .replace(/\s*-\s*undefined$/i, "")
    .replace(/^Item sin nombre\s*-\s*/i, "")
    .trim();
}

export function getStockMovementDraftKey(userId?: string | null, companyId?: string | null) {
  return userId && companyId ? `${NEW_STOCK_MOVEMENT_DRAFT_KEY}:${userId}:${companyId}` : null;
}

export function buildStockByItemId(rows: Pick<StockRow, "item_id" | "total">[]) {
  return new Map(rows.map((row) => [row.item_id, row.total]));
}

function readStoredDraft(storageKey: string | null) {
  if (!storageKey) return null;
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const draft = JSON.parse(raw) as StockMovementDraft;
    return {
      ...draft,
      itemSearch: sanitizeStockMovementItemSearch(draft.itemSearch),
    };
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

export function normalizeStockMovementItem(item: SearchableItem | null | undefined) {
  return item && typeof item.id === "string" && item.id.length > 0
    ? {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        supplier: item.supplier ?? null,
        brand: item.brand ?? null,
        model: item.model ?? null,
        attributes: item.attributes ?? null,
        category: item.category ?? null,
      }
    : null;
}

function normalizeMovementForm(form: Partial<StockMovementForm> | null | undefined): StockMovementForm {
  return {
    ...DEFAULT_STOCK_MOVEMENT_FORM,
    ...(form ?? {}),
    adjustment_direction: form?.adjustment_direction === "REMOVE" ? "REMOVE" : "ADD",
  };
}

export function useStockPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, currentCompany } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [movementSearch, setMovementSearch] = useState("");
  const deferredMovementSearch = useDeferredValue(movementSearch);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StockMovementForm>(DEFAULT_STOCK_MOVEMENT_FORM);
  const [itemSearch, setItemSearch] = useState("");
  const deferredItemSearch = useDeferredValue(itemSearch);
  const [selectedItem, setSelectedItem] = useState<SearchableItem | null>(null);
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const draftStorageKey = useMemo(
    () => getStockMovementDraftKey(user?.id, currentCompany?.id),
    [currentCompany?.id, user?.id],
  );

  useEffect(() => {
    setHydratedDraftKey(null);
    setDialogOpen(false);
    setForm(DEFAULT_STOCK_MOVEMENT_FORM);
    setItemSearch("");
    setSelectedItem(null);

    const draft = readStoredDraft(draftStorageKey);
    if (draft) {
      setDialogOpen(draft.open === true);
      setForm(normalizeMovementForm(draft.form));
      setItemSearch(draft.itemSearch);
      setSelectedItem(normalizeStockMovementItem(draft.selectedItem));
    }
    setHydratedDraftKey(draftStorageKey);
  }, [draftStorageKey]);

  const draftValue = useMemo<StockMovementDraft>(() => ({
    open: dialogOpen,
    form,
    itemSearch,
    selectedItem: normalizeStockMovementItem(selectedItem),
  }), [dialogOpen, form, itemSearch, selectedItem]);

  useSessionDraft({
    enabled: dialogOpen && hydratedDraftKey === draftStorageKey,
    storageKey: draftStorageKey,
    value: draftValue,
    read: () => {},
  });

  const resetMovementForm = useCallback(() => {
    setDialogOpen(false);
    setForm(DEFAULT_STOCK_MOVEMENT_FORM);
    setItemSearch("");
    setSelectedItem(null);
    clearSessionDraft(draftStorageKey);
  }, [draftStorageKey]);

  const openCreateMovement = useCallback((item?: SearchableItem) => {
    clearSessionDraft(draftStorageKey);
    setDialogOpen(true);
    setForm({ ...DEFAULT_STOCK_MOVEMENT_FORM, item_id: item?.id ?? "" });
    setItemSearch("");
    setSelectedItem(normalizeStockMovementItem(item));
  }, [draftStorageKey]);

  const { data: searchedItems = [], isFetching: searchingItems } = useQuery({
    queryKey: queryKeys.stock.itemSearch(currentCompany?.id ?? null, deferredItemSearch),
    enabled: Boolean(currentCompany && deferredItemSearch.trim()),
    queryFn: async () => {
      const searchTerm = deferredItemSearch.trim();
      const { data, error } = await supabase.rpc("search_items", {
        p_company_id: currentCompany!.id,
        p_query: searchTerm,
        p_limit: 20,
      });
      if (error) throw error;

      return (data ?? []) as SearchableItem[];
    },
  });

  const availableItems = useMemo(() => {
    if (!deferredItemSearch.trim()) return [];
    return searchedItems;
  }, [deferredItemSearch, searchedItems]);

  const itemsById = useMemo(
    () => new Map([...availableItems, ...(selectedItem ? [selectedItem] : [])].map((item) => [item.id, item])),
    [availableItems, selectedItem],
  );

  const { data: allStockRows = [], isLoading: loadingStock } = useQuery({
    queryKey: queryKeys.stock.current(currentCompany?.id ?? null, ""),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const [{ data: items, error: itemsError }, movements] = await Promise.all([
        supabase
          .from("items")
          .select("id, name, sku, unit, supplier, brand, model, attributes, category, demand_profile, demand_monthly_estimate")
          .eq("company_id", currentCompany!.id)
          .eq("is_active", true),
        fetchAllPages(() =>
          supabase
            .from("stock_movements")
            .select("item_id, type, quantity, created_at, items(name, sku, unit, brand, model, attributes, demand_profile, demand_monthly_estimate)")
            .eq("company_id", currentCompany!.id),
        ),
      ]);
      if (itemsError) throw itemsError;

      return buildStockRows(
        (items ?? []) as StockItemSource[],
        movements as StockMovementSource[],
      );
    },
  });

  const stockRows = useMemo(() => {
    const normalizedSearch = deferredSearch.trim();
    if (!normalizedSearch) return allStockRows;

    return allStockRows.filter((row) =>
      matchesNaturalItemSearch({
        id: row.item_id,
        name: row.item_name,
        sku: row.item_sku,
        unit: row.item_unit,
        supplier: row.item_supplier,
        brand: row.item_brand,
        model: row.item_model,
        attributes: row.item_attributes,
        category: row.item_category,
      }, normalizedSearch),
    );
  }, [allStockRows, deferredSearch]);

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: queryKeys.stock.movements(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, item_id, type, quantity, reference, created_at, created_by, items(name, sku, unit, brand, model, attributes)")
        .eq("company_id", currentCompany!.id)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;

      const userIds = Array.from(
        new Set((data ?? []).map((movement) => movement.created_by).filter(Boolean)),
      ) as string[];
      const namesByUserId = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        for (const profile of profiles ?? []) {
          namesByUserId.set(profile.user_id, profile.full_name || profile.user_id.slice(0, 8));
        }
      }

      return ((data ?? []) as Movement[]).map((movement) => ({
        ...movement,
        created_by_name: movement.created_by
          ? (namesByUserId.get(movement.created_by) ?? movement.created_by.slice(0, 8))
          : "Sistema",
      }));
    },
  });

  const stockByItemId = useMemo(
    () => buildStockByItemId(allStockRows),
    [allStockRows],
  );

  const filteredMovements = useMemo(() => {
    const normalizedSearch = deferredMovementSearch.trim().toLowerCase();
    if (!normalizedSearch) return movements;

    return movements.filter((movement) => {
      const item = movement.items;
      return (
        movement.reference?.toLowerCase().includes(normalizedSearch) ||
        movement.created_by_name?.toLowerCase().includes(normalizedSearch) ||
        item?.name?.toLowerCase().includes(normalizedSearch) ||
        item?.sku?.toLowerCase().includes(normalizedSearch) ||
        item?.brand?.toLowerCase().includes(normalizedSearch) ||
        item?.model?.toLowerCase().includes(normalizedSearch) ||
        item?.attributes?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [deferredMovementSearch, movements]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.item_id) throw new Error("Selecciona un item");
      if (!currentCompany) throw new Error("Selecciona una empresa para registrar stock");

      const selected = itemsById.get(form.item_id);
      if (!selected) {
        throw new Error("El item seleccionado ya no esta disponible. Recarga Stock e intenta de nuevo");
      }

      const quantity = parseFloat(form.quantity);
      if (Number.isNaN(quantity) || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("La cantidad debe ser mayor a 0");
      }
      if (isIntegerOnlyStockUnit(selected.unit) && !Number.isInteger(quantity)) {
        throw new Error("Este producto se mueve por unidad entera. Ingresa una cantidad sin decimales.");
      }

      const signedQuantity = form.type === "ADJUSTMENT" && form.adjustment_direction === "REMOVE" ? -quantity : quantity;

      const { error } = await supabase.from("stock_movements").insert({
        company_id: currentCompany.id,
        item_id: form.item_id,
        type: form.type,
        quantity: signedQuantity,
        reference: form.reference || null,
        created_by: user?.id ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm((currentForm) => ({
        ...DEFAULT_STOCK_MOVEMENT_FORM,
        item_id: currentForm.item_id,
      }));
      toast({ title: "Movimiento registrado" });
      void invalidateStockQueries(queryClient);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const handleFormChange = useCallback((nextForm: StockMovementForm) => {
    setForm(nextForm);
  }, []);

  const handleItemSearchChange = useCallback((value: string) => {
    setItemSearch(value);
  }, []);

  const handleSelectedItemChange = useCallback((item: SearchableItem | null) => {
    setSelectedItem(item);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (open) {
      setDialogOpen(true);
      return;
    }
    resetMovementForm();
  }, [resetMovementForm]);

  return {
    currentCompany,
    dialogOpen,
    form,
    itemSearch,
    availableItems,
    stockByItemId,
    selectedItem,
    searchingItems,
    allStockRows,
    stockRows,
    loadingStock,
    movements,
    filteredMovements,
    loadingMovements,
    search,
    setSearch,
    movementSearch,
    setMovementSearch,
    isSaving: saveMutation.isPending,
    openCreateMovement,
    handleDialogOpenChange,
    handleFormChange,
    handleItemSearchChange,
    handleSelectedItemChange,
    submitMovement: () => {
      if (form.type === "ADJUSTMENT" && form.adjustment_direction === "REMOVE") {
        const confirmed = window.confirm(
          "Vas a registrar un ajuste negativo. Verificá el item y la cantidad antes de continuar.",
        );
        if (!confirmed) return;
      }
      saveMutation.mutate();
    },
  };
}
