import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { DataCard, PageHeader, StatCard } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import {
  type DemandProfile,
  type Movement,
  type MovementType,
  type StockHealth,
  type StockRow,
} from "@/features/stock/types";

type SearchableItem = {
  id: string;
  name: string;
  sku: string;
  unit: string | null;
  brand?: string | null;
  model?: string | null;
};

const INTEGER_ONLY_UNITS = new Set(["un"]);
const NEW_STOCK_MOVEMENT_DRAFT_KEY = "stock:new-movement-draft";

function readStockMovementDraft() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(NEW_STOCK_MOVEMENT_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      open?: boolean;
      form?: { item_id: string; type: MovementType; quantity: string; reference: string };
      itemSearch?: string;
      selectedItem?: SearchableItem | null;
    };
  } catch {
    sessionStorage.removeItem(NEW_STOCK_MOVEMENT_DRAFT_KEY);
    return null;
  }
}

function writeStockMovementDraft(draft: {
  open: boolean;
  form: { item_id: string; type: MovementType; quantity: string; reference: string };
  itemSearch: string;
  selectedItem: SearchableItem | null;
}) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NEW_STOCK_MOVEMENT_DRAFT_KEY, JSON.stringify(draft));
}

function clearStockMovementDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(NEW_STOCK_MOVEMENT_DRAFT_KEY);
}

function formatQuantity(value: number, unit: string | null) {
  if (!Number.isFinite(value)) return "-";
  if (unit && INTEGER_ONLY_UNITS.has(unit)) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  const rounded = Number(value.toFixed(3));
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 3,
  }).format(rounded);
}

export default function StockPage() {
  const stockDraft = readStockMovementDraft();
  const [tab, setTab] = useState("summary");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(stockDraft?.open === true);
  const [form, setForm] = useState(stockDraft?.form ?? { item_id: "", type: "IN" as MovementType, quantity: "", reference: "" });
  const [itemSearch, setItemSearch] = useState(stockDraft?.itemSearch ?? "");
  const deferredItemSearch = useDeferredValue(itemSearch);
  const [selectedItem, setSelectedItem] = useState<SearchableItem | null>(stockDraft?.selectedItem ?? null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, currentCompany } = useAuth();

  const updateMovementDraft = (
    nextForm: { item_id: string; type: MovementType; quantity: string; reference: string },
    nextSearch = itemSearch,
    nextSelected = selectedItem,
    nextOpen = dialogOpen,
  ) => {
    setForm(nextForm);
    setItemSearch(nextSearch);
    setSelectedItem(nextSelected);
    setDialogOpen(nextOpen);
    if (nextOpen) {
      writeStockMovementDraft({
        open: nextOpen,
        form: nextForm,
        itemSearch: nextSearch,
        selectedItem: nextSelected,
      });
    } else {
      clearStockMovementDraft();
    }
  };

  const openCreateMovement = () => {
    updateMovementDraft({ item_id: "", type: "IN", quantity: "", reference: "" }, "", null, true);
  };

  const { data: recentItems = [] } = useQuery({
    queryKey: ["stock-recent-items", currentCompany?.id ?? "no-company", user?.id ?? "no-user"],
    enabled: Boolean(currentCompany && user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("item_id, created_at, items(id, name, sku, unit, brand, model, is_active)")
        .eq("company_id", currentCompany!.id)
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const deduped = new Map<string, SearchableItem>();
      for (const row of data ?? []) {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        if (!item || item.is_active === false || deduped.has(row.item_id)) continue;
        deduped.set(row.item_id, {
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          brand: item.brand,
          model: item.model,
        });
      }

      return Array.from(deduped.values()).slice(0, 8);
    },
  });

  const { data: searchedItems = [], isFetching: searchingItems } = useQuery({
    queryKey: ["stock-item-search", currentCompany?.id ?? "no-company", deferredItemSearch],
    enabled: Boolean(currentCompany && deferredItemSearch.trim()),
    queryFn: async () => {
      const searchTerm = deferredItemSearch.trim();
      let matchingItemIdsFromAlias: string[] = [];

      const { data: aliasMatches, error: aliasError } = await supabase
        .from("item_aliases")
        .select("item_id")
        .eq("company_id", currentCompany!.id)
        .ilike("alias", `%${searchTerm}%`)
        .limit(200);
      if (aliasError) throw aliasError;
      matchingItemIdsFromAlias = [...new Set((aliasMatches ?? []).map((row) => row.item_id))];

      let query = supabase
        .from("items")
        .select("id, name, sku, unit, brand, model")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true);

      const searchFilters = [
        `name.ilike.%${searchTerm}%`,
        `sku.ilike.%${searchTerm}%`,
        `brand.ilike.%${searchTerm}%`,
        `model.ilike.%${searchTerm}%`,
      ];
      if (matchingItemIdsFromAlias.length > 0) {
        searchFilters.push(`id.in.(${matchingItemIdsFromAlias.join(",")})`);
      }
      query = query.or(searchFilters.join(",")).order("name").limit(20);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SearchableItem[];
    },
  });

  const availableItems = useMemo(() => {
    const map = new Map<string, SearchableItem>();
    for (const item of recentItems) map.set(item.id, item);
    for (const item of searchedItems) map.set(item.id, item);
    if (selectedItem) map.set(selectedItem.id, selectedItem);
    return Array.from(map.values());
  }, [recentItems, searchedItems, selectedItem]);

  const itemsById = useMemo(
    () => new Map(availableItems.map((item) => [item.id, item])),
    [availableItems],
  );

  // Current stock calculated from movements
  const { data: stockRows = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-current", currentCompany?.id ?? "no-company", deferredSearch],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data: movements, error } = await supabase.from("stock_movements").select("item_id, type, quantity, created_at, items(name, sku, unit, demand_profile, demand_monthly_estimate)").eq("company_id", currentCompany!.id);
      if (error) throw error;

      const last30DaysTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const last90DaysTs = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const last365DaysTs = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const now = new Date();
      const map = new Map<string, StockRow & {
        out_30d: number;
        out_90d: number;
        out_365d: number;
        out_days_365: Set<string>;
        out_month_buckets_12m: number[];
      }>();
      for (const m of (movements ?? []) as Array<{
        item_id: string;
        type: MovementType;
        quantity: number;
        created_at: string;
        items?: {
          name?: string | null;
          sku?: string | null;
          unit?: string | null;
          demand_profile?: DemandProfile | null;
          demand_monthly_estimate?: number | null;
        } | null;
      }>) {
        if (!map.has(m.item_id)) {
          map.set(m.item_id, {
            item_id: m.item_id,
            item_name: m.items?.name ?? "",
            item_sku: m.items?.sku ?? "",
            item_unit: m.items?.unit ?? "",
            total: 0,
            avg_daily_out_30d: 0,
            avg_daily_out_90d: 0,
            avg_daily_out_365d: 0,
            demand_daily: 0,
            days_of_cover: null,
            months_of_cover_low_rotation: null,
            health: "GRAY",
            low_rotation: false,
            demand_profile: (m.items?.demand_profile as DemandProfile) ?? "LOW",
            demand_monthly_estimate: m.items?.demand_monthly_estimate ?? null,
            out_30d: 0,
            out_90d: 0,
            out_365d: 0,
            out_days_365: new Set<string>(),
            out_month_buckets_12m: Array.from({ length: 12 }, () => 0),
          });
        }
        const row = map.get(m.item_id)!;
        if (m.type === "IN") row.total += Number(m.quantity);
        else if (m.type === "OUT") row.total -= Number(m.quantity);
        else row.total += Number(m.quantity); // ADJUSTMENT can be +/-
        if (m.type === "OUT" && new Date(m.created_at).getTime() >= last30DaysTs) {
          row.out_30d += Math.max(0, Number(m.quantity));
        }
        if (m.type === "OUT" && new Date(m.created_at).getTime() >= last90DaysTs) {
          row.out_90d += Math.max(0, Number(m.quantity));
        }
        if (m.type === "OUT" && new Date(m.created_at).getTime() >= last365DaysTs) {
          const outQty = Math.max(0, Number(m.quantity));
          row.out_365d += outQty;
          const moveDate = new Date(m.created_at);
          row.out_days_365.add(m.created_at.slice(0, 10));
          const monthDiff = (now.getFullYear() - moveDate.getFullYear()) * 12 + (now.getMonth() - moveDate.getMonth());
          if (monthDiff >= 0 && monthDiff < 12) {
            row.out_month_buckets_12m[monthDiff] += outQty;
          }
        }
      }

      let rows = Array.from(map.values()).map((r) => {
        const avgDailyOut30 = r.out_30d / 30;
        const avgDailyOut90 = r.out_90d / 90;
        const avgDailyOut365 = r.out_365d / 365;
        const demandDaily = Math.max(
          avgDailyOut365,
          (avgDailyOut30 * 0.5) + (avgDailyOut90 * 0.3) + (avgDailyOut365 * 0.2),
        );
        const monthlyDemand365 = r.out_365d / 12;
        const monthlyDemand90 = r.out_90d / 3;
        const lowRotation = r.demand_profile === "LOW";
        const daysOfCover = demandDaily > 0 ? r.total / demandDaily : null;
        const sortedMonthlyDemand = [...r.out_month_buckets_12m].sort((a, b) => a - b);
        const lowSeasonIdx = Math.floor((sortedMonthlyDemand.length - 1) * 0.35);
        const lowSeasonMonthlyDemand = sortedMonthlyDemand[lowSeasonIdx] ?? 0;
        const lowRotationCandidates = [lowSeasonMonthlyDemand, monthlyDemand365, monthlyDemand90].filter((v) => v > 0);
        const monthlyDemandLowRotationAuto = lowRotationCandidates.length > 0 ? Math.min(...lowRotationCandidates) : 0;
        const monthlyDemandLowRotation = (r.demand_monthly_estimate ?? 0) > 0
          ? (r.demand_monthly_estimate as number)
          : monthlyDemandLowRotationAuto;
        const monthsOfCoverLowRotation = monthlyDemandLowRotation > 0 ? r.total / monthlyDemandLowRotation : null;
        let health: StockHealth = "GRAY";
        if (r.total <= 0) {
          health = "RED";
        } else if (lowRotation) {
          health = r.total <= 2 ? "YELLOW" : "GREEN";
        } else {
          const redThreshold = r.demand_profile === "HIGH" ? 15 : 10;
          const yellowThreshold = r.demand_profile === "HIGH" ? 30 : 20;
          if (daysOfCover !== null && daysOfCover < redThreshold) health = "RED";
          else if (daysOfCover !== null && daysOfCover < yellowThreshold) health = "YELLOW";
          else health = "GREEN";
        }
        return {
          item_id: r.item_id,
          item_name: r.item_name,
          item_sku: r.item_sku,
          item_unit: r.item_unit,
          total: r.total,
          avg_daily_out_30d: avgDailyOut30,
          avg_daily_out_90d: avgDailyOut90,
          avg_daily_out_365d: avgDailyOut365,
          demand_daily: demandDaily,
          days_of_cover: daysOfCover,
          months_of_cover_low_rotation: monthsOfCoverLowRotation,
          health,
          low_rotation: lowRotation,
          demand_profile: r.demand_profile,
          demand_monthly_estimate: r.demand_monthly_estimate,
        };
      });
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r) => r.item_name.toLowerCase().includes(s) || r.item_sku.toLowerCase().includes(s));
      }
      return rows.sort((a, b) => a.item_name.localeCompare(b.item_name));
    },
  });

  // Movements history
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["stock-movements", currentCompany?.id ?? "no-company"],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, item_id, type, quantity, reference, created_at, created_by, items(name, sku, unit)")
        .eq("company_id", currentCompany!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = Array.from(new Set((data ?? []).map((m) => m.created_by).filter(Boolean))) as string[];
      const namesByUserId = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        for (const p of profiles ?? []) {
          namesByUserId.set(p.user_id, p.full_name || p.user_id.slice(0, 8));
        }
      }

      return ((data ?? []) as Movement[]).map((m) => ({
        ...m,
        created_by_name: m.created_by ? (namesByUserId.get(m.created_by) ?? m.created_by.slice(0, 8)) : "Sistema",
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.item_id) throw new Error("Selecciona un item");

      if (!currentCompany) throw new Error("Selecciona una empresa para registrar stock");
      const selected = itemsById.get(form.item_id);
      if (!selected) {
        throw new Error("El item seleccionado ya no esta disponible. Recarga Stock e intenta de nuevo");
      }
      const qty = parseFloat(form.quantity);
      if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0) throw new Error("La cantidad debe ser mayor a 0");
      if (selected.unit && INTEGER_ONLY_UNITS.has(selected.unit) && !Number.isInteger(qty)) {
        throw new Error("Este producto se mueve por unidad entera. Ingresa una cantidad sin decimales.");
      }
      const { error } = await supabase.from("stock_movements").insert({
        company_id: currentCompany.id,
        item_id: form.item_id,
        type: form.type,
        quantity: qty,
        reference: form.reference || null,
        created_by: user?.id ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-recent-items"] });
      qc.invalidateQueries({ queryKey: ["stock-item-search"] });
      clearStockMovementDraft();
      setDialogOpen(false);
      setForm({ item_id: "", type: "IN", quantity: "", reference: "" });
      setSelectedItem(null);
      setItemSearch("");
      toast({ title: "Movimiento registrado" });
    },
    onError: (e: unknown) => toast({
      title: "Error",
      description: e instanceof Error ? e.message : "Error desconocido",
      variant: "destructive",
    }),
  });

  const typeIcon = (t: MovementType) => {
    if (t === "IN") return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
    if (t === "OUT") return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
    return <Settings2 className="h-4 w-4 text-yellow-500" />;
  };

  const typeLabel: Record<MovementType, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste" };
  const healthLabel: Record<StockHealth, string> = {
    GREEN: "Verde",
    YELLOW: "Amarillo",
    RED: "Rojo",
    GRAY: "Sin datos",
  };
  const healthClass: Record<StockHealth, string> = {
    GREEN: "bg-emerald-600 text-white border-emerald-700",
    YELLOW: "bg-amber-500 text-black border-amber-600",
    RED: "bg-red-600 text-white border-red-700",
    GRAY: "bg-slate-600 text-white border-slate-700",
  };
  const alertToneLabel: Record<StockHealth, string> = {
    GREEN: "OK",
    YELLOW: "Atención",
    RED: "Crítico",
    GRAY: "Info",
  };
  const alertRowClass: Record<StockHealth, string> = {
    GREEN: "border-success/18 bg-success/10 text-foreground",
    YELLOW: "border-warning/18 bg-warning/10 text-foreground",
    RED: "border-destructive/18 bg-destructive/10 text-foreground",
    GRAY: "border-border/70 bg-[hsl(var(--panel))]/66 text-foreground",
  };
  const alertBadgeClass: Record<StockHealth, string> = {
    GREEN: "border-success/18 bg-success text-success-foreground",
    YELLOW: "border-warning/18 bg-warning text-warning-foreground",
    RED: "border-destructive/18 bg-destructive text-destructive-foreground",
    GRAY: "border-border/70 bg-muted text-foreground",
  };
  const demandProfileLabel: Record<DemandProfile, string> = {
    LOW: "Rotación baja",
    MEDIUM: "Rotación media",
    HIGH: "Rotación alta",
  };
  const demandProfileClass: Record<DemandProfile, string> = {
    LOW: "border-border/70 bg-muted text-foreground",
    MEDIUM: "border-info/16 bg-info/10 text-info",
    HIGH: "border-primary/16 bg-primary/10 text-primary",
  };
  const STOCK_PAGE_SIZE = 10;
  const alerts = useMemo(() => {
    const critical = stockRows
      .filter((r) => r.health === "RED")
      .map((r) => ({
        id: `critical-${r.item_id}`,
        tone: "RED" as const,
        title: `${r.item_name} en riesgo critico`,
        detail: r.total <= 0
          ? "Sin stock o en negativo. Reposicion urgente."
          : `Cobertura estimada: ${Math.max(0, r.days_of_cover ?? 0).toFixed(1)} dias.`,
      }));
    const low = stockRows
      .filter((r) => r.health === "YELLOW")
      .map((r) => ({
        id: `low-${r.item_id}`,
        tone: "YELLOW" as const,
        title: `${r.item_name} con cobertura baja`,
        detail: `Cobertura estimada: ${(r.days_of_cover ?? 0).toFixed(1)} dias.`,
      }));
    const overstock = stockRows
      .filter((r) => !r.low_rotation && r.days_of_cover !== null && r.days_of_cover > 90)
      .map((r) => ({
        id: `over-${r.item_id}`,
        tone: "GRAY" as const,
        title: `${r.item_name} con posible sobrestock`,
        detail: `Cobertura estimada: ${r.days_of_cover!.toFixed(1)} dias.`,
      }));
    const lowRotationInfo = stockRows
      .filter((r) => r.low_rotation && r.total > 0)
      .map((r) => {
        const m = r.months_of_cover_low_rotation;
        if (m !== null && m >= 24) {
          return {
            id: `slow-over-${r.item_id}`,
            tone: "YELLOW" as const,
            title: `${r.item_name} con sobrestock en baja rotacion`,
            detail: `Cobertura estimada: ${m.toFixed(1)} meses. Revisar compras futuras.`,
          };
        }
        return {
          id: `slow-${r.item_id}`,
          tone: "GRAY" as const,
          title: `${r.item_name} con rotacion baja`,
          detail: m !== null
            ? `Cobertura estimada en baja rotacion: ${m < 0.1 ? "<0.1" : m.toFixed(1)} meses.`
            : "Demanda muy baja/irregular: el semaforo prioriza stock disponible.",
        };
      });
    return [...critical, ...low, ...overstock, ...lowRotationInfo];
  }, [stockRows]);
  const warningCount = useMemo(
    () => alerts.filter((alert) => alert.tone === "YELLOW").length,
    [alerts],
  );
  const safeAlertsPage = Math.min(alertsPage, Math.max(1, Math.ceil(alerts.length / STOCK_PAGE_SIZE)));
  const pagedAlerts = useMemo(() => {
    const start = (safeAlertsPage - 1) * STOCK_PAGE_SIZE;
    return alerts.slice(start, start + STOCK_PAGE_SIZE);
  }, [alerts, safeAlertsPage]);
  const alertsTotalPages = Math.max(1, Math.ceil(alerts.length / STOCK_PAGE_SIZE));
  const sortedStockRows = useMemo(() => {
    const priority: Record<StockHealth, number> = {
      RED: 0,
      YELLOW: 1,
      GRAY: 2,
      GREEN: 3,
    };
    return [...stockRows].sort((a, b) => {
      const diff = priority[a.health] - priority[b.health];
      if (diff !== 0) return diff;
      return a.item_name.localeCompare(b.item_name);
    });
  }, [stockRows]);
  const safeStockPage = Math.min(stockPage, Math.max(1, Math.ceil(sortedStockRows.length / STOCK_PAGE_SIZE)));
  const pagedStockRows = useMemo(() => {
    const start = (safeStockPage - 1) * STOCK_PAGE_SIZE;
    return sortedStockRows.slice(start, start + STOCK_PAGE_SIZE);
  }, [sortedStockRows, safeStockPage]);
  const stockTotalPages = Math.max(1, Math.ceil(sortedStockRows.length / STOCK_PAGE_SIZE));
  const formatCoverage = (value: number | null, unit: "m" | "d") => {
    if (value === null || !Number.isFinite(value)) return "Sin consumo";
    if (value <= 0) return `0 ${unit}`;
    if (value < 0.1) return `<0.1 ${unit}`;
    return `${value.toFixed(1)} ${unit}`;
  };

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para ver existencias y registrar movimientos de stock." />
        ) : null}
        <PageHeader
          eyebrow="Control de existencias"
          title="Stock"
          subtitle="Control de existencias, cobertura y movimientos con la misma lógica actual en una jerarquía más clara."
          tabs={[
            { label: "Resumen", value: "summary" },
            { label: "Stock", value: "current" },
            { label: "Movimientos", value: "movements" },
          ]}
          activeTab={tab}
          onTabChange={setTab}
          actions={(
            <Button onClick={openCreateMovement}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
            </Button>
          )}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="summary" className="space-y-6 pt-1">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="En rojo" value={stockRows.filter((r) => r.health === "RED").length} tone="danger" />
              <StatCard label="En amarillo" value={warningCount} tone="warning" />
              <StatCard label="Sin datos" value={stockRows.filter((r) => r.health === "GRAY").length} />
              <StatCard label="Alertas" value={alerts.length} tone="success" />
            </div>
            <p className="text-xs text-muted-foreground">
              Semáforo automático: combina consumo de 30, 90 y 365 días, con tratamiento especial para rotación baja.
            </p>
            {alerts.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/70 bg-[hsl(var(--panel))]/55">
                  <CardTitle className="text-lg">Alertas inteligentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-7">
                  {pagedAlerts.map((a) => (
                    <div key={a.id} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4.5 text-sm shadow-[var(--shadow-xs)] ${alertRowClass[a.tone]}`}>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{a.title}</p>
                        <p className="mt-1 text-muted-foreground">{a.detail}</p>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0", alertBadgeClass[a.tone])}>
                        {alertToneLabel[a.tone]}
                      </Badge>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {(safeAlertsPage - 1) * STOCK_PAGE_SIZE + (pagedAlerts.length === 0 ? 0 : 1)}-{Math.min(safeAlertsPage * STOCK_PAGE_SIZE, alerts.length)} de {alerts.length} alertas
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => setAlertsPage((prev) => Math.max(1, prev - 1))} disabled={safeAlertsPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-24 text-center text-sm text-muted-foreground">Pagina {safeAlertsPage} de {alertsTotalPages}</span>
                      <Button type="button" variant="outline" size="icon" onClick={() => setAlertsPage((prev) => Math.min(alertsTotalPages, prev + 1))} disabled={safeAlertsPage >= alertsTotalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="current" className="space-y-5 pt-1">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="stock-search"
                name="stock-search"
                aria-label="Buscar item en stock"
                placeholder="Buscar item..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DataCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Semáforo</TableHead>
                    <TableHead className="text-right">Cobertura</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStock ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : sortedStockRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin movimientos de stock</TableCell></TableRow>
                  ) : pagedStockRows.map((r) => (
                    <TableRow key={r.item_id} className="align-top">
                      <TableCell className="py-4 font-mono text-xs">{r.item_sku}</TableCell>
                      <TableCell className="py-4 text-sm font-semibold leading-6">{r.item_name}</TableCell>
                      <TableCell className="py-4 text-sm">{r.item_unit}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px]", healthClass[r.health])}>
                            {healthLabel[r.health]}
                          </Badge>
                          <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px]", demandProfileClass[r.demand_profile])}>
                            {demandProfileLabel[r.demand_profile]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right font-mono">
                        {r.low_rotation
                          ? formatCoverage(r.months_of_cover_low_rotation, "m")
                          : formatCoverage(r.days_of_cover, "d")}
                      </TableCell>
                      <TableCell className="py-4 text-right text-[15px] font-bold">{formatQuantity(r.total, r.item_unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataCard>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Mostrando {(safeStockPage - 1) * STOCK_PAGE_SIZE + (pagedStockRows.length === 0 ? 0 : 1)}-{Math.min(safeStockPage * STOCK_PAGE_SIZE, sortedStockRows.length)} de {sortedStockRows.length} productos</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setStockPage((prev) => Math.max(1, prev - 1))} disabled={safeStockPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-24 text-center text-sm text-muted-foreground">Pagina {safeStockPage} de {stockTotalPages}</span>
                <Button type="button" variant="outline" size="icon" onClick={() => setStockPage((prev) => Math.min(stockTotalPages, prev + 1))} disabled={safeStockPage >= stockTotalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="movements">
            <DataCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMovements ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : movements.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin movimientos</TableCell></TableRow>
                  ) : movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleString("es-AR")}</TableCell>
                      <TableCell className="text-sm">{m.created_by_name ?? "Sistema"}</TableCell>
                      <TableCell><div className="flex items-center gap-2">{typeIcon(m.type)}<span className="text-sm">{typeLabel[m.type]}</span></div></TableCell>
                      <TableCell className="font-medium">{m.items?.name ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono">{formatQuantity(m.quantity, m.items?.unit ?? null)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.reference ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataCard>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          clearStockMovementDraft();
          setForm({ item_id: "", type: "IN", quantity: "", reference: "" });
          setSelectedItem(null);
          setItemSearch("");
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stock-item-search">Item *</Label>
                <Input
                  id="stock-item-search"
                  name="stock-item-search"
                  value={itemSearch}
                  onChange={(e) => updateMovementDraft(form, e.target.value, selectedItem)}
                  placeholder="Buscar por SKU, nombre, marca, modelo o alias..."
                />
              </div>
              {selectedItem ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{selectedItem.sku} - {selectedItem.name}</p>
                  <p className="text-muted-foreground">
                    {[selectedItem.brand, selectedItem.model].filter(Boolean).join(" / ") || "Sin marca/modelo"}
                  </p>
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Resultados</p>
                  {searchingItems ? <p className="text-xs text-muted-foreground">Buscando...</p> : null}
                </div>
                {!deferredItemSearch.trim() ? (
                  <p className="text-sm text-muted-foreground">Empeza a escribir para buscar un producto.</p>
                ) : searchedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No encontramos productos para esa busqueda.</p>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-2">
                    {searchedItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          updateMovementDraft({ ...form, item_id: item.id }, itemSearch, item);
                        }}
                        className={`flex w-full flex-col rounded-md border px-3 py-2 text-left transition-colors ${
                          form.item_id === item.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{item.sku} - {item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[item.brand, item.model].filter(Boolean).join(" / ") || "Sin marca/modelo"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock-movement-type">Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => updateMovementDraft({ ...form, type: v as MovementType })}>
                  <SelectTrigger id="stock-movement-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Salida</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-movement-quantity">Cantidad *</Label>
                <Input
                  id="stock-movement-quantity"
                  name="stock-movement-quantity"
                  type="number"
                  min={selectedItem?.unit && INTEGER_ONLY_UNITS.has(selectedItem.unit) ? 1 : 0.000001}
                  step={selectedItem?.unit && INTEGER_ONLY_UNITS.has(selectedItem.unit) ? 1 : "any"}
                  value={form.quantity}
                  onChange={(e) => updateMovementDraft({ ...form, quantity: e.target.value })}
                  required
                />
                {selectedItem?.unit && INTEGER_ONLY_UNITS.has(selectedItem.unit) ? (
                  <p className="text-xs text-muted-foreground">Este producto se mueve solo en cantidades enteras.</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-movement-reference">Referencia</Label>
              <Input
                id="stock-movement-reference"
                name="stock-movement-reference"
                value={form.reference}
                onChange={(e) => updateMovementDraft({ ...form, reference: e.target.value })}
              />
            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">Ultimos usados</p>
                <p className="text-[11px] text-muted-foreground">Solo tuyos</p>
              </div>
              {recentItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no tenés productos recientes.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recentItems.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant={form.item_id === item.id ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        updateMovementDraft({ ...form, item_id: item.id }, itemSearch, item);
                      }}
                      className="h-7 max-w-full border border-slate-200 bg-white px-2 text-[11px] text-slate-700 hover:bg-slate-100"
                    >
                      <span className="truncate">{item.sku} - {item.name}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending || !form.item_id}>
                {saveMutation.isPending ? "Guardando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


