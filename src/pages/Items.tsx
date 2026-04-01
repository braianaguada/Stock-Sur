import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { cleanText, normalizeAlias } from "@/lib/clean";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { ITEM_UNIT_OPTIONS } from "@/features/items/constants";
import { type Item, type ItemAlias } from "@/features/items/types";
import { generateItemSku } from "@/features/items/utils";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const NEW_ITEM_DRAFT_KEY = "items:new-item-draft";

type ItemSortField = "sku" | "name" | "brand" | "model" | "category" | "is_active" | "created_at";
type SortDirection = "asc" | "desc";

function SortableHead(props: {
  label: string;
  field: ItemSortField;
  sortBy: ItemSortField;
  sortDirection: SortDirection;
  onSort: (field: ItemSortField) => void;
  className?: string;
}) {
  const { label, field, sortBy, sortDirection, onSort, className } = props;
  const active = sortBy === field;
  const Icon = active ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 font-medium text-left hover:text-foreground"
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}

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
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
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
  const aliasQueryKey = ["item-aliases", currentCompany?.id ?? "no-company", editingItem?.id] as const;

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
    queryKey: [
      "items",
      currentCompany?.id ?? "no-company",
      deferredSearch,
      categoryFilter,
      statusFilter,
      page,
      pageSize,
      sortBy,
      sortDirection,
    ],
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
  const items = itemsQuery.data?.rows ?? [];
  const totalItems = itemsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const isLoading = itemsQuery.isLoading;

  const { data: categories = [] } = useQuery({
    queryKey: ["items-categories", currentCompany?.id ?? "no-company", statusFilter],
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
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedItemIds.includes(item.id));
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
        if (!itemsById.has(editingItem.id)) {
          throw new Error("El ítem que estás editando ya no está disponible. Recargá Ítems e intentá de nuevo");
        }
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-categories"] });
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-item-search"] });
      qc.invalidateQueries({ queryKey: ["stock-recent-items"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-categories"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items-categories"] });
      toast({ title: "Ítem reactivado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addAliasMutation = useMutation({
    mutationFn: async (alias: string) => {
      if (!editingItem) throw new Error("Seleccioná un ítem antes de agregar alias");

      if (!itemsById.has(editingItem.id)) {
        throw new Error("El ítem seleccionado ya no está disponible. Recargá Ítems e intentá de nuevo");
      }

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
      qc.invalidateQueries({ queryKey: ["items"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["stock-current"] });
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
      qc.invalidateQueries({ queryKey: ["items"] });
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
      <div className="space-y-6">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitás una empresa activa para gestionar artículos, alias y catálogos de stock." />
        ) : null}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ítems</h1>
            <p className="text-muted-foreground">Catálogo maestro de productos</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorias</SelectItem>
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
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => setSelectedItemIds(checked === true ? items.map((item) => item.id) : [])}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <SortableHead label="SKU" field="sku" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableHead label="Nombre" field="name" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableHead label="Marca" field="brand" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableHead label="Modelo" field="model" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableHead label="Categoria" field="category" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                <TableHead>Unidad</TableHead>
                <TableHead>Demanda</TableHead>
                <SortableHead label="Activo" field="is_active" sortBy={sortBy} sortDirection={sortDirection} onSort={toggleSort} />
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                    No se encontraron ítems
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="h-9">
                    <TableCell className="py-1.5">
                      <Checkbox
                        checked={selectedItemIds.includes(item.id)}
                        onCheckedChange={(checked) => setSelectedItemIds((prev) => (
                          checked === true
                            ? (prev.includes(item.id) ? prev : [...prev, item.id])
                            : prev.filter((id) => id !== item.id)
                        ))}
                        aria-label={`Seleccionar ${item.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-1.5 font-mono text-[11px]">{item.sku}</TableCell>
                    <TableCell className="py-1.5 text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="py-1.5 text-xs">{item.brand ?? "-"}</TableCell>
                    <TableCell className="py-1.5 text-xs">{item.model ?? "-"}</TableCell>
                    <TableCell className="py-1.5 text-xs">{item.category ?? "—"}</TableCell>
                    <TableCell className="py-1.5 text-xs">{item.unit}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {item.demand_profile === "HIGH" ? "Alta" : item.demand_profile === "MEDIUM" ? "Media" : "Baja"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant={item.is_active ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                        {item.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {item.is_active ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setItemToDelete(item)} title="Desactivar">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => restoreMutation.mutate(item.id)} title="Reactivar">
                            <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {rangeStart}-{rangeEnd} de {totalItems} items
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="items-page-size" className="text-sm text-muted-foreground">
                Por pagina
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])}
              >
                <SelectTrigger id="items-page-size" className="w-[96px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-24 text-center text-sm text-muted-foreground">
                Pagina {page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open && currentCompany && !editingItem) {
          sessionStorage.removeItem(`${NEW_ITEM_DRAFT_KEY}:${currentCompany.id}`);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SKU</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, sku: generateItemSku(prev.name || "item") }))}
                >
                  Autogenerar
                </Button>
              </div>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Ej: BOMBA-001" />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unidad *</Label>
                <Select value={form.unit || "un"} onValueChange={(value) => setForm({ ...form, unit: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar unidad" /></SelectTrigger>
                  <SelectContent>
                    {ITEM_UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de demanda *</Label>
              <Select value={form.demand_profile} onValueChange={(value) => setForm({ ...form, demand_profile: value as Item["demand_profile"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja rotación</SelectItem>
                  <SelectItem value="MEDIUM">Rotación media</SelectItem>
                  <SelectItem value="HIGH">Alta rotación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Consumo mensual estimado (opcional)</Label>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Ej: 7"
                value={form.demand_monthly_estimate}
                onChange={(e) => setForm({ ...form, demand_monthly_estimate: e.target.value })}
              />
            </div>
            {editingItem && (
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <h3 className="text-sm font-semibold">Alias/Códigos</h3>
                  <p className="text-xs text-muted-foreground">Administrá códigos alternativos del ítem.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Nuevo alias..."
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isSupplierCode}
                      onChange={(e) => setIsSupplierCode(e.target.checked)}
                      className="rounded"
                    />
                    Cód. proveedor
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addAlias}
                  >
                    Agregar
                  </Button>
                </div>
                <div className="space-y-1">
                  {aliases.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">Sin alias</p>
                  )}
                  {aliases.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{a.alias}</span>
                        {a.is_supplier_code && (
                          <Badge variant="outline" className="text-xs">código</Badge>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAliasToDelete(a)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open) setItemToDelete(null);
        }}
        title="Eliminar item"
        description={itemToDelete ? `Esta accion eliminara "${itemToDelete.name}" de forma permanente.` : ""}
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
        description={aliasToDelete ? `Esta accion eliminara el alias "${aliasToDelete.alias}".` : ""}
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

