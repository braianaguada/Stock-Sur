import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search } from "lucide-react";
import { cleanText, normalizeAlias } from "@/lib/clean";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { invalidateItemQueries, invalidateStockQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const NEW_ITEM_DRAFT_KEY = "items:new-item-draft";


export default function ItemsPage() {
  const { currentCompany } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [aliasToDelete, setAliasToDelete] = useState<ItemAlias | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [sortBy, setSortBy] = useState<ItemSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [form, setForm] = useState({
    sku: "",
    name: "",
    brand: "",
    model: "",
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

  const itemsQuery = useQuery({
    queryKey: queryKeys.items.list(currentCompany?.id ?? null, deferredSearch, categoryFilter, statusFilter, page, pageSize, sortBy, sortDirection),
    enabled: Boolean(currentCompany),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const searchTerm = deferredSearch.trim();
      let matchingItemIdsFromAlias: string[] = [];

      if (searchTerm) {
        const { data: aliasMatches, error: aliasError } = await supabase
          .from("item_aliases")
          .select("item_id")
          .eq("company_id", currentCompany!.id)
          .ilike("alias", `%${searchTerm}%`)
          .limit(500);
        if (aliasError) throw aliasError;
        matchingItemIdsFromAlias = [...new Set((aliasMatches ?? []).map((a) => a.item_id))];
      }

      let q = supabase
        .from("items")
        .select("*", { count: "exact" })
        .eq("company_id", currentCompany!.id);
      if (statusFilter === "active") q = q.eq("is_active", true);
      if (statusFilter === "inactive") q = q.eq("is_active", false);

      if (searchTerm) {
        const searchFilters = [
          `name.ilike.%${searchTerm}%`,
          `sku.ilike.%${searchTerm}%`,
          `brand.ilike.%${searchTerm}%`,
          `model.ilike.%${searchTerm}%`,
        ];

        if (matchingItemIdsFromAlias.length > 0) {
          searchFilters.push(`id.in.(${matchingItemIdsFromAlias.join(",")})`);
        }

        q = q.or(searchFilters.join(","));
      }

      if (categoryFilter !== "all") {
        q = q.eq("category", categoryFilter);
      }

      q = q.order(sortBy, {
        ascending: sortDirection === "asc",
        nullsFirst: false,
      });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return {
        rows: (data ?? []) as Item[],
        total: count ?? 0,
      };
    },
  });
  const items = useMemo(() => itemsQuery.data?.rows ?? [], [itemsQuery.data?.rows]);
  const totalItems = itemsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const isLoading = itemsQuery.isLoading;

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
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  const toggleSort = (field: ItemSortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDirection(field === "is_active" ? "desc" : "asc");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) throw new Error("Seleccioná una empresa para gestionar ítems");
      const name = cleanText(form.name);
      const sku = cleanText(form.sku).toUpperCase();
      const brand = cleanText(form.brand) || null;
      const model = cleanText(form.model) || null;
      const unit = cleanText(form.unit) || "un";

      if (!name) {
        throw new Error("Nombre obligatorio");
      }

      const monthlyEstimate = form.demand_monthly_estimate.trim() === "" ? null : Number(form.demand_monthly_estimate);
      const payload = {
        name,
        brand,
        model,
        unit,
        category: cleanText(form.category) || null,
        demand_profile: form.demand_profile,
        demand_monthly_estimate: Number.isFinite(monthlyEstimate) ? monthlyEstimate : null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("items")
          .update({
            ...payload,
            sku: sku || editingItem.sku,
          })
          .eq("company_id", currentCompany.id)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("items")
          .insert({
            company_id: currentCompany.id,
            ...payload,
            sku: sku || generateItemSku(name),
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
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
      await invalidateItemQueries(qc);
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
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.items.all() }),
        invalidateStockQueries(qc),
      ]);
      setSelectedItemIds([]);
      toast({ title: "Tipo de demanda actualizado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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
      brand: "",
      model: "",
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
      brand: item.brand ?? "",
      model: item.model ?? "",
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
          subtitle="Gestioná productos, alias y demanda sin perder velocidad operativa. El rediseño mejora lectura y jerarquía sobre la misma lógica actual."
          actions={(
            <>
              <Button asChild variant="outline">
                <Link to="/items/catalog/import-legacy">Importar catálogo</Link>
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo
              </Button>
            </>
          )}
          meta={(
            <>
              <Badge variant="outline">{totalItems} registrados</Badge>
              <Badge variant="secondary">{selectedItemIds.length} seleccionados</Badge>
            </>
          )}
        />


        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por SKU, nombre, marca, modelo o alias..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full md:w-52">
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
          <div className="w-full md:w-64">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-64">
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
            disabled={selectedItemIds.length === 0 || bulkDemandProfileMutation.isPending}
            onClick={() => bulkDemandProfileMutation.mutate()}
          >
            Aplicar a seleccionados ({selectedItemIds.length})
          </Button>
        </FilterBar>

        <DataCard>
          <ItemsDataTable
            items={items}
            isLoading={isLoading}
            pageSize={pageSize}
            selectedItemIds={selectedItemIds}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={toggleSort}
            onSelectionChange={setSelectedItemIds}
            onEdit={openEdit}
            onDelete={setItemToDelete}
            onRestore={(itemId) => restoreMutation.mutate(itemId)}
          />
        </DataCard>
        <DataTablePagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
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



