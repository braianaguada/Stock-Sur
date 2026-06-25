import { useMutation } from "@tanstack/react-query";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { supabase } from "@/integrations/supabase/client";

function buildFallbackSummary(companyName: string, dashboard: DashboardInsights) {
  const { metrics } = dashboard;
  const priorities = dashboard.actions
    .filter((action) => action.count > 0)
    .slice(0, 3)
    .map((action) => `${action.label.toLowerCase()} (${action.count})`);
  const growth = metrics.salesGrowthPct >= 0
    ? `Las ventas muestran una variacion positiva de ${metrics.salesGrowthPct}%.`
    : `Las ventas muestran una variacion negativa de ${Math.abs(metrics.salesGrowthPct)}%.`;
  const cash = metrics.cashNetMonth >= 0
    ? "El resultado de caja del mes es positivo."
    : "El resultado de caja del mes es negativo y requiere revision.";
  const priorityText = priorities.length
    ? `Prioridades inmediatas: ${priorities.join(", ")}.`
    : "No se detectan pendientes operativos relevantes.";

  return `Lectura automatica de ${companyName}: ${growth} ${cash} ${priorityText}`;
}

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
      if (error) {
        return {
          summary: buildFallbackSummary(companyName, dashboard),
          fallback: true,
        };
      }
      const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
      if (!summary) {
        return {
          summary: buildFallbackSummary(companyName, dashboard),
          fallback: true,
        };
      }
      return { summary, fallback: false };
    },
  });
}
