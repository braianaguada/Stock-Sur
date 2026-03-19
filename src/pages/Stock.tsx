import { useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Settings2 } from "lucide-react";

type MovementType = "IN" | "OUT" | "ADJUSTMENT";
type StockHealth = "GREEN" | "YELLOW" | "RED" | "GRAY";
type DemandProfile = "LOW" | "MEDIUM" | "HIGH";

interface StockRow {
  item_id: string;
  item_name: string;
  item_sku: string;
  item_unit: string;
  total: number;
  avg_daily_out_30d: number;
  avg_daily_out_90d: number;
  avg_daily_out_365d: number;
  demand_daily: number;
  days_of_cover: number | null;
  months_of_cover_low_rotation: number | null;
  health: StockHealth;
  low_rotation: boolean;
  demand_profile: DemandProfile;
  demand_monthly_estimate: number | null;
}

interface Movement {
  id: string;
  item_id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  items?: { name: string; sku: string } | null;
}

export default function StockPage() {
  const [tab, setTab] = useState("current");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", type: "IN" as MovementType, quantity: "", reference: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, currentCompany } = useAuth();

  // Items for select
  const { data: items = [] } = useQuery({
    queryKey: ["items-list", currentCompany?.id ?? "no-company"],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, name, sku, unit").eq("company_id", currentCompany!.id).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Current stock calculated from movements
  const { data: stockRows = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-current", currentCompany?.id ?? "no-company", search],
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
        .select("id, item_id, type, quantity, reference, created_at, created_by, items(name, sku)")
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
      if (!form.item_id) throw new Error("Seleccioná un ítem");

      if (!currentCompany) throw new Error("Selecciona una empresa para registrar stock");
      const qty = parseFloat(form.quantity);
      if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0) throw new Error("La cantidad debe ser mayor a 0");
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
      setDialogOpen(false);
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
    YELLOW: "Atencion",
    RED: "Critico",
    GRAY: "Info",
  };
  const alertRowClass: Record<StockHealth, string> = {
    GREEN: "border-emerald-200 bg-emerald-50",
    YELLOW: "border-amber-200 bg-amber-50",
    RED: "border-red-200 bg-red-50",
    GRAY: "border-slate-200 bg-slate-50",
  };
  const alertBadgeClass: Record<StockHealth, string> = {
    GREEN: "bg-emerald-600 text-white border-emerald-700",
    YELLOW: "bg-amber-500 text-black border-amber-600",
    RED: "bg-red-600 text-white border-red-700",
    GRAY: "bg-slate-600 text-white border-slate-700",
  };
  const demandProfileLabel: Record<DemandProfile, string> = {
    LOW: "Rotacion baja",
    MEDIUM: "Rotacion media",
    HIGH: "Rotacion alta",
  };
  const demandProfileClass: Record<DemandProfile, string> = {
    LOW: "bg-slate-100 text-slate-700 border-slate-200",
    MEDIUM: "bg-blue-100 text-blue-700 border-blue-200",
    HIGH: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  };
  const alerts = useMemo(() => {
    const critical = stockRows
      .filter((r) => r.health === "RED")
      .slice(0, 6)
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
      .slice(0, 4)
      .map((r) => ({
        id: `low-${r.item_id}`,
        tone: "YELLOW" as const,
        title: `${r.item_name} con cobertura baja`,
        detail: `Cobertura estimada: ${(r.days_of_cover ?? 0).toFixed(1)} dias.`,
      }));
    const overstock = stockRows
      .filter((r) => !r.low_rotation && r.days_of_cover !== null && r.days_of_cover > 90)
      .slice(0, 3)
      .map((r) => ({
        id: `over-${r.item_id}`,
        tone: "GRAY" as const,
        title: `${r.item_name} con posible sobrestock`,
        detail: `Cobertura estimada: ${r.days_of_cover!.toFixed(1)} dias.`,
      }));
    const lowRotationInfo = stockRows
      .filter((r) => r.low_rotation && r.total > 0)
      .slice(0, 6)
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
  const formatCoverage = (value: number | null, unit: "m" | "d") => {
    if (value === null || !Number.isFinite(value)) return "—";
    if (value <= 0) return `0 ${unit}`;
    if (value < 0.1) return `<0.1 ${unit}`;
    return `${value.toFixed(1)} ${unit}`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para ver existencias y registrar movimientos de stock." />
        ) : null}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
            <p className="text-muted-foreground">Movimientos y stock actual</p>
          </div>
          <Button onClick={() => { setForm({ item_id: "", type: "IN", quantity: "", reference: "" }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="current">Stock actual</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-red-500/70 bg-red-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm">En rojo</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{stockRows.filter((r) => r.health === "RED").length}</p></CardContent>
              </Card>
              <Card className="border-amber-500/70 bg-amber-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm">En amarillo</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{stockRows.filter((r) => r.health === "YELLOW").length}</p></CardContent>
              </Card>
              <Card className="border-slate-500/70 bg-slate-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Sin datos</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{stockRows.filter((r) => r.health === "GRAY").length}</p></CardContent>
              </Card>
              <Card className="border-emerald-500/70 bg-emerald-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{alerts.length}</p></CardContent>
              </Card>
            </div>
            <p className="text-xs text-muted-foreground">
              Semaforo automatico: combina consumo de 30, 90 y 365 dias, con tratamiento especial para rotacion baja.
            </p>
            {alerts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Alertas inteligentes</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.id} className={`flex items-center justify-between rounded-md border p-2 text-sm ${alertRowClass[a.tone]}`}>
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-muted-foreground">{a.detail}</p>
                      </div>
                      <Badge variant="outline" className={alertBadgeClass[a.tone]}>
                        {alertToneLabel[a.tone]}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar ítem..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="rounded-lg border bg-card">
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
                  ) : stockRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin movimientos de stock</TableCell></TableRow>
                  ) : stockRows.map((r) => (
                    <TableRow key={r.item_id}>
                      <TableCell className="font-mono text-xs">{r.item_sku}</TableCell>
                      <TableCell className="font-medium">{r.item_name}</TableCell>
                      <TableCell>{r.item_unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={healthClass[r.health]}>
                            {healthLabel[r.health]}
                          </Badge>
                          <Badge variant="outline" className={demandProfileClass[r.demand_profile]}>
                            {demandProfileLabel[r.demand_profile]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.low_rotation
                          ? formatCoverage(r.months_of_cover_low_rotation, "m")
                          : formatCoverage(r.days_of_cover, "d")}
                      </TableCell>
                      <TableCell className="text-right font-bold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="movements">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ítem</TableHead>
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
                      <TableCell className="font-medium">{m.items?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.reference ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Ítem *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar ítem" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.sku} — {i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as MovementType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Salida</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input type="number" min={0.000001} step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2"><Label>Referencia</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                        <DialogFooter><Button type="submit" disabled={saveMutation.isPending || !form.item_id}>{saveMutation.isPending ? "Guardando..." : "Registrar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
