import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ExternalLink, Plus, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { EntityDialog } from "@/components/common/EntityDialog";
import { PrimaryCell, MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import {
  archiveMarketSignal,
  createMarketSignal,
  fetchMarketItems,
  fetchMarketMovements,
  fetchMarketSignals,
  type MarketSignal,
} from "@/features/market-radar/data";
import { buildItemTrends, type ItemTrend, type TrendSignal } from "@/features/market-radar/trends";
import { useToast } from "@/hooks/use-toast";
import { canEditStock, canViewStock } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";

const SIGNAL_LABELS: Record<string, string> = {
  DEMAND: "Demanda",
  NOVELTY: "Novedad",
  COMPETITOR: "Competencia",
  PRICE: "Precio",
};

const TREND_LABELS: Record<TrendSignal, string> = {
  RISING: "En alza",
  STABLE: "Estable",
  FALLING: "En baja",
  LOW_VOLUME: "Volumen bajo",
};

const emptyForm = () => ({
  title: "",
  sourceName: "",
  sourceUrl: "",
  signalType: "DEMAND",
  observedPrice: "",
  currency: "ARS",
  itemId: "NONE",
  observedAt: new Date().toISOString().slice(0, 10),
  notes: "",
});

export default function MarketRadar() {
  const { currentCompany, roles, companyRoleCodes, companyPermissionCodes } = useAuth();
  const companyId = currentCompany?.id ?? null;
  const access = { companyRoleCodes, companyPermissionCodes };
  const canView = canViewStock(roles, access);
  const canEdit = canEditStock(roles, access);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const itemsQuery = useQuery({
    queryKey: queryKeys.marketRadar.items(companyId),
    enabled: Boolean(companyId && canView),
    queryFn: () => fetchMarketItems(companyId!),
  });

  const trendsQuery = useQuery({
    queryKey: queryKeys.marketRadar.trends(companyId),
    enabled: Boolean(companyId && canView && itemsQuery.data),
    queryFn: async () => buildItemTrends(itemsQuery.data ?? [], await fetchMarketMovements(companyId!)),
  });

  const signalsQuery = useQuery({
    queryKey: queryKeys.marketRadar.signals(companyId),
    enabled: Boolean(companyId && canView),
    queryFn: () => fetchMarketSignals(companyId!),
  });

  const itemMap = useMemo(() => new Map((itemsQuery.data ?? []).map((item) => [item.id, item])), [itemsQuery.data]);
  const filteredTrends = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    return (trendsQuery.data ?? []).filter((trend) => !needle || `${trend.name} ${trend.sku}`.toLocaleLowerCase("es").includes(needle));
  }, [search, trendsQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !canEdit) throw new Error("No tenes permisos para registrar señales de mercado.");
      const title = form.title.trim();
      const sourceName = form.sourceName.trim();
      let sourceUrl: URL;
      try { sourceUrl = new URL(form.sourceUrl.trim()); } catch { throw new Error("Ingresá una URL válida con http:// o https://."); }
      if (!["http:", "https:"].includes(sourceUrl.protocol)) throw new Error("La fuente debe usar http:// o https://.");
      if (title.length < 2 || sourceName.length < 2) throw new Error("Completá el título y el nombre de la fuente.");
      const observedPrice = form.observedPrice === "" ? null : Number(form.observedPrice);
      if (observedPrice !== null && (!Number.isFinite(observedPrice) || observedPrice < 0)) throw new Error("El precio observado no es válido.");
      await createMarketSignal({
        company_id: companyId,
        item_id: form.itemId === "NONE" ? null : form.itemId,
        title,
        source_name: sourceName,
        source_url: sourceUrl.toString(),
        signal_type: form.signalType,
        observed_price: observedPrice,
        currency: form.currency.trim().toUpperCase(),
        observed_at: form.observedAt,
        notes: form.notes.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketRadar.signals(companyId) });
      setDialogOpen(false);
      setForm(emptyForm());
      toast({ title: "Señal de mercado guardada" });
    },
    onError: (error: Error) => toast({ title: "No se pudo guardar la señal", description: error.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (signalId: string) => {
      if (!companyId || !canEdit) throw new Error("No tenes permisos para archivar señales.");
      await archiveMarketSignal(companyId, signalId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketRadar.signals(companyId) });
      toast({ title: "Señal archivada" });
    },
    onError: (error: Error) => toast({ title: "No se pudo archivar", description: error.message, variant: "destructive" }),
  });

  const trendColumns = useMemo<ColumnDef<ItemTrend, unknown>[]>(() => [
    { accessorKey: "name", header: () => "Producto", cell: ({ row }) => <PrimaryCell title={row.original.name} metadata={`${row.original.sku} · ${row.original.unit}`} /> },
    { accessorKey: "currentUnits", header: () => <span className="block text-right">Últimos 30 días</span>, cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.currentUnits.toLocaleString("es-AR")}</span> },
    { accessorKey: "previousUnits", header: () => <span className="block text-right">30 días anteriores</span>, cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.previousUnits.toLocaleString("es-AR")}</span>, meta: { className: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" } },
    { accessorKey: "changePct", header: () => "Variación", cell: ({ row }) => row.original.changePct === null ? "Demanda nueva" : `${row.original.changePct >= 0 ? "+" : ""}${row.original.changePct.toFixed(0)}%`, meta: { className: "hidden md:table-cell", cellClassName: "hidden md:table-cell" } },
    { accessorKey: "signal", header: () => "Lectura", cell: ({ row }) => <StatusBadge tone={row.original.signal === "RISING" ? "success" : row.original.signal === "FALLING" ? "warning" : row.original.signal === "LOW_VOLUME" ? "muted" : "info"}>{TREND_LABELS[row.original.signal]}</StatusBadge> },
  ], []);

  const signalColumns = useMemo<ColumnDef<MarketSignal, unknown>[]>(() => [
    { accessorKey: "title", header: () => "Señal", cell: ({ row }) => <PrimaryCell title={row.original.title} metadata={row.original.notes ?? SIGNAL_LABELS[row.original.signal_type]} /> },
    { accessorKey: "item_id", header: () => "Producto", cell: ({ row }) => row.original.item_id ? itemMap.get(row.original.item_id)?.name ?? "Producto no disponible" : "Sin vincular", meta: { className: "hidden md:table-cell", cellClassName: "hidden md:table-cell" } },
    { accessorKey: "observed_price", header: () => <span className="block text-right">Precio visto</span>, cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.observed_price === null ? "—" : `${row.original.currency} ${Number(row.original.observed_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}</span>, meta: { className: "hidden sm:table-cell text-right", cellClassName: "hidden sm:table-cell text-right" } },
    { accessorKey: "observed_at", header: () => "Fecha", cell: ({ row }) => new Date(`${row.original.observed_at}T12:00:00`).toLocaleDateString("es-AR"), meta: { className: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell" } },
    { id: "actions", header: () => <span className="sr-only">Acciones</span>, cell: ({ row }) => <RowActions><RowActionButton label={`Abrir ${row.original.source_name}`} tone="view" onClick={() => window.open(row.original.source_url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" /></RowActionButton>{canEdit ? <RowActionButton label="Archivar señal" tone="warning" onClick={() => archiveMutation.mutate(row.original.id)}><Archive className="h-4 w-4" /></RowActionButton> : null}</RowActions>, meta: { className: "w-24 text-right", cellClassName: "text-right" } },
  ], [archiveMutation, canEdit, itemMap]);

  const trends = trendsQuery.data ?? [];
  const risingCount = trends.filter((trend) => trend.signal === "RISING").length;
  const fallingCount = trends.filter((trend) => trend.signal === "FALLING").length;

  return (
    <AppLayout>
      <PageContainer archetype="analytical" className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Necesitás una empresa activa para consultar tendencias de movimiento." /> : null}
        {currentCompany && !canView ? <CompanyAccessNotice description="No tenés permisos para consultar información de stock." /> : null}
        <PageHeader eyebrow="Inventario y mercado" title="Radar de mercado" subtitle="Compara salidas reales de los últimos 30 días y conserva señales externas con su fuente verificable." variant="analytical" actions={canEdit ? <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nueva señal</Button> : null} />

        {currentCompany && canView ? <>
          <MetricGrid columns={3}>
            <MetricCard label="Productos en alza" value={risingCount} format="plain" tone="success" helper="Con volumen relevante y crecimiento ≥ 25%." icon={<TrendingUp className="h-5 w-5" />} />
            <MetricCard label="Productos en baja" value={fallingCount} format="plain" tone="warning" helper="Comparación contra los 30 días previos." icon={<TrendingDown className="h-5 w-5" />} />
            <MetricCard label="Señales externas" value={(signalsQuery.data ?? []).length} format="plain" tone="info" helper="Datos manuales con enlace a la fuente." icon={<ExternalLink className="h-5 w-5" />} />
          </MetricGrid>

          <Card className="shadow-none">
            <CardHeader><CardTitle>Tendencia interna</CardTitle><CardDescription>Solo usa movimientos OUT reales. Los volúmenes menores a 3 unidades se muestran como volumen bajo para evitar falsas alarmas.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <FilterToolbar><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o SKU" className="pl-9" /></div></FilterToolbar>
              <DataTable columns={trendColumns} data={filteredTrends} emptyMessage="No hay salidas reales en los últimos 60 días." isLoading={trendsQuery.isLoading || itemsQuery.isLoading} errorMessage={trendsQuery.error instanceof Error ? trendsQuery.error.message : itemsQuery.error instanceof Error ? itemsQuery.error.message : undefined} onRetry={() => { void itemsQuery.refetch(); void trendsQuery.refetch(); }} />
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader><CardTitle>Señales externas</CardTitle><CardDescription>Registro manual: Stock Sur no interpreta Internet ni recomienda compras automáticamente. Abrí siempre la fuente antes de decidir.</CardDescription></CardHeader>
            <CardContent><DataTable columns={signalColumns} data={signalsQuery.data ?? []} emptyMessage="Todavía no registraste señales externas." isLoading={signalsQuery.isLoading} errorMessage={signalsQuery.error instanceof Error ? signalsQuery.error.message : undefined} onRetry={() => void signalsQuery.refetch()} /></CardContent>
          </Card>
        </> : null}
      </PageContainer>

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Nueva señal de mercado" description="Guardá qué observaste y la fuente para poder verificarla después." footer={<><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? "Guardando..." : "Guardar señal"}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="market-title">Qué observaste</Label><Input id="market-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej.: subió la oferta de bombas de agua" /></div>
          <div className="space-y-2"><Label htmlFor="market-source">Fuente</Label><Input id="market-source" value={form.sourceName} onChange={(event) => setForm((current) => ({ ...current, sourceName: event.target.value }))} placeholder="Proveedor, marketplace o fabricante" /></div>
          <div className="space-y-2"><Label htmlFor="market-url">Enlace verificable</Label><Input id="market-url" type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://..." /></div>
          <div className="space-y-2"><Label>Tipo</Label><Select value={form.signalType} onValueChange={(value) => setForm((current) => ({ ...current, signalType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SIGNAL_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Producto relacionado (opcional)</Label><Select value={form.itemId} onValueChange={(value) => setForm((current) => ({ ...current, itemId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Sin vincular</SelectItem>{(itemsQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.sku}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="market-price">Precio observado (opcional)</Label><Input id="market-price" type="number" min="0" step="0.01" value={form.observedPrice} onChange={(event) => setForm((current) => ({ ...current, observedPrice: event.target.value }))} /></div>
          <div className="grid grid-cols-[1fr_7rem] gap-3"><div className="space-y-2"><Label htmlFor="market-date">Fecha</Label><Input id="market-date" type="date" value={form.observedAt} onChange={(event) => setForm((current) => ({ ...current, observedAt: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="market-currency">Moneda</Label><Input id="market-currency" maxLength={3} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></div></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="market-notes">Notas</Label><Textarea id="market-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contexto útil para revisar esta señal" /></div>
        </div>
      </EntityDialog>
    </AppLayout>
  );
}
