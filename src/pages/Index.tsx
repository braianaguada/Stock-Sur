import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, RefreshCw, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { InfoBadge, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
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
            <h2 id="dashboard-ai-title" className="font-semibold">Lectura ejecutiva bajo demanda</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.data?.summary ?? "Generá una lectura complementaria de tendencias y prioridades usando los datos visibles de este panel."}</p>
            {summary.data?.fallback ? <p className="mt-2 text-xs text-warning">Se utilizó la lectura local porque el servicio de IA no estaba disponible.</p> : null}
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full shrink-0 justify-center rounded-full sm:w-auto lg:ml-auto lg:self-center" disabled={summary.isPending} onClick={() => summary.mutate({ companyName, dashboard })}>
          {summary.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {summary.data ? "Actualizar lectura" : "Generar lectura"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const [periodPreset, setPeriodPreset] = useState<"day" | "week" | "month">("month");
  const period = useMemo(() => {
    const today = new Date();
    const from = new Date(today);
    if (periodPreset === "week") from.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    if (periodPreset === "month") from.setDate(1);
    const iso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return { granularity: "day" as const, from: iso(from), to: iso(today) };
  }, [periodPreset]);
  const { dashboard, isLoading, isFetching, error, hasData, dataUpdatedAt, refetch, periodData, isPeriodLoading } = useDashboardStats({ companyId: currentCompany?.id, period });

  return (
    <AppLayout>
      <PageContainer archetype="analytical" className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Tu cuenta todavía no tiene una empresa activa." /> : null}

        {currentCompany ? (
          <>
            <PageHeader
              eyebrow="Inicio · período actual"
              title="Dashboard"
              subtitle={`Ventas, inventario y operación de ${settings.app_name} en una sola lectura.`}
              variant="analytical"
              meta={(
                <>
                  {dataUpdatedAt ? <InfoBadge>Actualizado {updatedAt.format(dataUpdatedAt)}</InfoBadge> : null}
                  {isFetching && !isLoading ? <StatusBadge tone="info" announce><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Actualizando</StatusBadge> : null}
                </>
              )}
              actions={<Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>}
            />

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
                  <div className="min-w-0 xl:col-span-8"><DashboardHero key={currentCompany.id} dashboard={dashboard} /></div>
                  <div className="min-w-0 xl:col-span-4"><OperationalAttention actions={dashboard.actions} /></div>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-12">
                  <div className="min-w-0 xl:col-span-8"><DashboardOperationalPulse dashboard={dashboard} /></div>
                  <div className="min-w-0 xl:col-span-4"><DashboardHighlights dashboard={dashboard} /></div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-lg font-semibold">Análisis por período</h2><p className="text-sm text-muted-foreground">Ventas, costos, ganancia y productos del intervalo seleccionado.</p></div>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período del análisis">
                    {(["day", "week", "month"] as const).map((preset) => <Button key={preset} type="button" size="sm" variant={periodPreset === preset ? "default" : "outline"} onClick={() => setPeriodPreset(preset)}>{preset === "day" ? "Hoy" : preset === "week" ? "Esta semana" : "Este mes"}</Button>)}
                  </div>
                </div>
                <DashboardPeriodInsights data={periodData} loading={isPeriodLoading} />
                <DashboardAiInsight key={currentCompany.id} companyName={settings.app_name} dashboard={dashboard} />
              </>
            )}
          </>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
