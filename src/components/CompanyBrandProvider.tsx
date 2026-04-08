import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyBrandContext, DEFAULT_COMPANY_SETTINGS, type CompanySettings } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";
import { applyCompanyTheme } from "@/lib/companyTheme";

export function CompanyBrandProvider({ children }: { children: ReactNode }) {
  const { currentCompany, session } = useAuth();
  const query = useQuery({
    queryKey: ["company-settings", currentCompany?.id ?? "default"],
    enabled: Boolean(session?.user && currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { ...DEFAULT_COMPANY_SETTINGS, company_id: currentCompany!.id }) as CompanySettings;
    },
  });

  const settings = useMemo(() => (
    query.data ?? {
      ...DEFAULT_COMPANY_SETTINGS,
      app_name: currentCompany?.name ?? DEFAULT_COMPANY_SETTINGS.app_name,
      legal_name: currentCompany?.name ?? DEFAULT_COMPANY_SETTINGS.legal_name,
      company_id: currentCompany?.id ?? null,
    }
  ), [currentCompany?.id, currentCompany?.name, query.data]);

  useEffect(() => {
    applyCompanyTheme(settings);
  }, [settings]);

  const value = useMemo(() => ({
    settings,
    isLoading: query.isLoading,
  }), [settings, query.isLoading]);

  return <CompanyBrandContext.Provider value={value}>{children}</CompanyBrandContext.Provider>;
}
