import { useQuery } from "@tanstack/react-query";
import { FileText, Package, Truck, Warehouse } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/page";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();

  const { data: itemCount } = useQuery({
    queryKey: ["items-count", currentCompany?.id ?? "no-company"],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { count } = await supabase.from("items").select("*", { count: "exact", head: true }).eq("company_id", currentCompany!.id);
      return count ?? 0;
    },
  });

  const { data: supplierCount } = useQuery({
    queryKey: ["suppliers-count", currentCompany?.id ?? "no-company"],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { count } = await supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("company_id", currentCompany!.id);
      return count ?? 0;
    },
  });

  const { data: quoteCount } = useQuery({
    queryKey: ["quotes-count", currentCompany?.id ?? "no-company"],
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const { count } = await supabase
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany!.id);
      return count ?? 0;
    },
  });

  const stats = [
    {
      label: "Ítems",
      value: itemCount ?? 0,
      icon: <Package className="h-5 w-5" />,
      hint: "Catálogo operativo listo para vender y comprar.",
    },
    {
      label: "Proveedores",
      value: supplierCount ?? 0,
      icon: <Truck className="h-5 w-5" />,
      hint: "Relaciones comerciales activas y listas para importar.",
    },
    {
      label: "Presupuestos",
      value: quoteCount ?? 0,
      icon: <FileText className="h-5 w-5" />,
      hint: "Documentos comerciales generados desde el sistema.",
    },
  ];

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Tu cuenta todavía no tiene una empresa activa. Cuando el superadmin te asigne una, vas a ver acá el resumen de esa operación." />
        ) : null}

        <PageHeader
          eyebrow="Panel ejecutivo"
          title="Dashboard"
          description={`Resumen general de ${settings.app_name}. Mantiene foco operativo con mejor jerarquía visual, más aire y menos ruido.`}
          meta={(
            <>
              <Badge variant="outline">Empresa activa</Badge>
              <Badge variant="secondary">Operación en tiempo real</Badge>
            </>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} hint={stat.hint} tone="info" />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Panorama</p>
                <h2 className="mt-2 text-xl font-bold">Operación ordenada para escritorio</h2>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-primary/10 p-3 text-primary">
                <Warehouse className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              Este dashboard mantiene la lógica actual y eleva la lectura visual: superficies más limpias, señales más claras
              y una presentación más alineada con un producto SaaS premium.
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
