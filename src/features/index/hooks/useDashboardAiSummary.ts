import { useMutation } from "@tanstack/react-query";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardAiSummary() {
  return useMutation({
    mutationFn: async ({ companyName, dashboard }: { companyName: string; dashboard: DashboardInsights }) => {
      const { data, error } = await supabase.functions.invoke("dashboard-ai-summary", {
        body: {
          companyName,
          snapshot: {
            metrics: dashboard.metrics,
            actions: dashboard.actions.filter((action) => action.count > 0),
            monthlyCash: dashboard.monthlyCash,
            paymentMethods: dashboard.paymentMethods,
            slowStock: dashboard.slowStock,
            stockVelocity: dashboard.stockVelocity,
          },
        },
      });
      if (error) throw error;
      const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
      if (!summary) throw new Error("La IA no devolvio un resumen.");
      return summary;
    },
  });
}
