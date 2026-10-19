import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, RefreshCw, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { InfoBadge, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dashboardPeriod, periodError as validatePeriod, buildPeriodViews, periodPayments, type PeriodPreset } from "@/features/index/dashboard-period";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { DashboardHero } from "@/features/index/components/DashboardHero";
import { DashboardHighlights } from "@/features/index/components/DashboardHighlights";
import { DashboardPeriodInsights } from "@/features/index/components/DashboardPeriodInsights";
import { DashboardLoading } from "@/features/index/components/DashboardLoading";
import { DashboardOperationalPulse } from "@/features/index/components/DashboardOperationalPulse";
import { OperationalAttention } from "@/features/index/components/OperationalAttention";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { useDashboardAiSummary } from "@/features/index/hooks/useDashboardAiSummary";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";

const updatedAt = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export function DashboardAiInsight({ companyName, dashboard }: { companyName: string; dashboard: DashboardInsights }) {
  const summary = useDashboardAiSummary();

  return (
    <Card className="mt-5 border-border/70 shadow-none" aria-labelledby="dashboard-ai-title">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="dashboard-ai-title" className="font-semibold">Resumen automático</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.data?.summary ?? "Generá un resumen de los datos actuales."}</p>
            <p className="mt-1 text-xs text-muted-foreground">Datos actuales, sin filtro de fechas.</p>
            {summary.data?.fallback ? <p className="mt-2 text-xs text-warning">Se utilizó la lectura local porque el servicio de IA no estaba disponible.</p> : null}
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full shrink-0 justify-center rounded-full sm:w-auto lg:ml-auto lg:self-center" disabled={summary.isPending} onClick={() => summary.mutate({ companyName, dashboard })}>
          {summary.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {summary.data ? "Actualizar resumen" : "Generar resumen"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState(() => dashboardPeriod("month", "", "").from);
  const [customTo, setCustomTo] = useState(() => dashboardPeriod("month", "", "").to);
  const period = useMemo(() => dashboardPeriod(periodPreset, customFrom, customTo), [periodPreset, customFrom, customTo]);
  const validationError = validatePeriod(period.from, period.to);
  const { dashboard, isLoading, isFetching, error, hasData, dataUpdatedAt, refetch, periodData, isPeriodLoading, periodError, isPeriodFetching } = useDashboardStats({ companyId: currentCompany?.id, period: validationError ? undefined : period });
  const periodReady = !validationError && !periodError && !isPeriodLoading && !!periodData;
  const heroViews = buildPeriodViews(dashboard, periodReady ? periodData : undefined);

  return (
    <AppLayout>
      <PageContainer archetype="analytical" className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Tu cuenta todavía no tiene una empresa activa." /> : null}

        {currentCompany ? (
          <>
            <PageHeader
              eyebrow="Inicio · análisis comercial"
              title="Dashboard"
              variant="analytical"
              meta={(
                <>
                  {dataUpdatedAt ? <InfoBadge>Actualizado {updatedAt.format(dataUpdatedAt)}</InfoBadge> : null}
                  {isFetching && !isLoading ? <StatusBadge tone="info" announce><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Actualizando</StatusBadge> : null}
                </>
              )}
              actions={<Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>}
            />

            <section className="mb-5 space-y-3 rounded-xl border border-border/70 p-4" aria-label="Período del análisis">
              <div><h2 className="font-semibold">Período del análisis</h2></div>
              <div className="flex flex-wrap gap-2">
                {([["day", "Hoy"], ["week", "Esta semana"], ["month", "Este mes"], ["previous-month", "Mes anterior"], ["custom", "Personalizado"]] as const).map(([preset, label]) => <Button key={preset} type="button" size="sm" aria-pressed={periodPreset === preset} variant={periodPreset === preset ? "default" : "outline"} onClick={() => setPeriodPreset(preset)}>{label}</Button>)}
              </div>
              {periodPreset === "custom" ? <div className="flex flex-wrap gap-3">
                <div className="space-y-1"><Label htmlFor="dashboard-from">Desde</Label><Input id="dashboard-from" type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="dashboard-to">Hasta</Label><Input id="dashboard-to" type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} /></div>
              </div> : null}
              {validationError ? <p role="alert" className="text-sm text-destructive">{validationError}</p> : null}
              {periodError ? <div role="alert" className="text-sm text-destructive">No pudimos cargar el período: {periodError.message} <Button variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button></div> : null}
              {isPeriodFetching ? <p role="status" className="text-sm text-muted-foreground">Actualizando período…</p> : null}
            </section>

            {error ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/[.04] p-4 sm:flex-row sm:items-center" role="alert">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                <div className="flex-1"><p className="font-medium">No pudimos actualizar el panel</p><p className="text-sm text-muted-foreground">{hasData ? "Conservamos la última información disponible; podés volver a intentar." : "No mostramos valores hasta poder verificar la información de la empresa."}</p></div>
                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>
              </div>
            ) : null}

            {isLoading ? <DashboardLoading /> : error && !hasData ? null : (
              <>
                <div className="grid gap-5 xl:grid-cols-12">
                  <div className="min-w-0 xl:col-span-8">{heroViews.length ? <DashboardHero key={currentCompany.id} dashboard={dashboard} periodViews={heroViews} /> : null}{!periodReady ? <p role="status" className="p-5 text-sm text-muted-foreground">{isPeriodLoading ? "Cargando indicadores del período…" : "Seleccioná un período válido con datos verificados para ver los indicadores."}</p> : null}</div>
                  <div className="min-w-0 xl:col-span-4"><OperationalAttention actions={dashboard.actions} /></div>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-12">
                  <div className="min-w-0 xl:col-span-8"><DashboardOperationalPulse dashboard={dashboard} /></div>
                  <div className="min-w-0 xl:col-span-4">{periodReady ? <DashboardHighlights dashboard={dashboard} periodMethods={periodPayments(periodData)} /> : null}</div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-lg font-semibold">Ventas</h2></div>
                </div>
                {periodReady ? <DashboardPeriodInsights data={periodData} loading={false} /> : null}
                <DashboardAiInsight key={currentCompany.id} companyName={settings.app_name} dashboard={dashboard} />
              </>
            )}
          </>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
