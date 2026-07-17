import { AlertTriangle, BrainCircuit, RefreshCw, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { DashboardHero } from "@/features/index/components/DashboardHero";
import { DashboardHighlights } from "@/features/index/components/DashboardHighlights";
import { DashboardLoading } from "@/features/index/components/DashboardLoading";
import { OperationalAttention } from "@/features/index/components/OperationalAttention";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { useDashboardAiSummary } from "@/features/index/hooks/useDashboardAiSummary";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";

const updatedAt = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

function DashboardAiInsight({ companyName, dashboard }: { companyName: string; dashboard: DashboardInsights }) {
  const summary = useDashboardAiSummary();

  return (
    <section className="dashboard-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6" aria-labelledby="dashboard-ai-title">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="dashboard-ai-title" className="font-semibold">Lectura ejecutiva bajo demanda</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.data?.summary ?? "Generá una lectura complementaria de tendencias y prioridades usando los datos visibles de este panel."}</p>
        {summary.data?.fallback ? <p className="mt-2 text-xs text-warning">Se utilizó la lectura local porque el servicio de IA no estaba disponible.</p> : null}
      </div>
      <Button type="button" variant="outline" className="rounded-full" disabled={summary.isPending} onClick={() => summary.mutate({ companyName, dashboard })}>
        {summary.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {summary.data ? "Actualizar lectura" : "Generar lectura"}
      </Button>
    </section>
  );
}

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const { dashboard, isLoading, isFetching, error, hasData, dataUpdatedAt, refetch } = useDashboardStats({ companyId: currentCompany?.id });

  return (
    <AppLayout>
      <div className="space-y-5">
        {!currentCompany ? <CompanyAccessNotice description="Tu cuenta todavía no tiene una empresa activa." /> : null}

        {currentCompany ? (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Inicio · período actual</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pulso del negocio</h1>
                <p className="mt-1 text-sm text-muted-foreground">Ventas, inventario y operación de {settings.app_name} en una sola lectura.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {dataUpdatedAt ? <Badge variant="outline" className="rounded-full">Actualizado {updatedAt.format(dataUpdatedAt)}</Badge> : null}
                {isFetching && !isLoading ? <Badge variant="secondary" className="rounded-full"><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Actualizando</Badge> : null}
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
              </div>
            </header>

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
                  <div className="xl:col-span-8"><DashboardHero key={currentCompany.id} dashboard={dashboard} /></div>
                  <div className="xl:col-span-4"><OperationalAttention actions={dashboard.actions} /></div>
                </div>
                <DashboardHighlights dashboard={dashboard} />
                <DashboardAiInsight key={currentCompany.id} companyName={settings.app_name} dashboard={dashboard} />
              </>
            )}
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
