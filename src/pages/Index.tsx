import { Warehouse } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/page";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const { stats } = useDashboardStats({ companyId: currentCompany?.id });

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Tu cuenta todavia no tiene una empresa activa. Cuando el superadmin te asigne una, vas a ver aca el resumen de esa operacion." />
        ) : null}

        <PageHeader
          eyebrow="Panel ejecutivo"
          title="Dashboard"
          description={`Resumen general de ${settings.app_name}. Mantiene foco operativo con mejor jerarquia visual, mas aire y menos ruido.`}
          meta={(
            <>
              <Badge variant="outline">Empresa activa</Badge>
              <Badge variant="secondary">Operacion en tiempo real</Badge>
            </>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={<stat.icon className="h-5 w-5" />}
              hint={stat.hint}
              tone="info"
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Panorama</p>
                <h2 className="mt-2 text-xl font-bold">Operacion ordenada para escritorio</h2>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-primary/10 p-3 text-primary">
                <Warehouse className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              Este dashboard mantiene la logica actual y eleva la lectura visual: superficies mas limpias, senales mas claras
              y una presentacion mas alineada con un producto SaaS premium.
            </p>
          </div>

          <div className="surface-card-muted p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Estado visual</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/85 px-4 py-3">
                <span className="text-sm font-medium">Topbar, cards y tablas</span>
                <Badge variant="outline">Pulido activo</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/85 px-4 py-3">
                <span className="text-sm font-medium">Flujos y datos</span>
                <Badge variant="secondary">Sin cambios funcionales</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
