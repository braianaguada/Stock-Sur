import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Warehouse, FileText, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";

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
    { label: "Ítems", value: itemCount ?? 0, icon: Package },
    { label: "Proveedores", value: supplierCount ?? 0, icon: Truck },
    { label: "Presupuestos", value: quoteCount ?? 0, icon: FileText },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general de {settings.app_name}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
