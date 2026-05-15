import { Banknote, CircleDollarSign, Landmark, Receipt, Smartphone, TrendingDown } from "lucide-react";
import { MetricCard, MetricGrid, MetricHeroCard } from "@/components/common/VisualSystem";
import type { CashSummary } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
};

export function CashSummaryCards({ summary }: CashSummaryCardsProps) {
  const cards = [
    {
      label: "Efectivo remito",
      value: summary.efectivoRemito,
      icon: <Banknote className="h-4 w-4" />,
      tone: "success" as const,
      helper: "Ventas en efectivo con remito.",
    },
    {
      label: "Efectivo facturable",
      value: summary.efectivoFacturable,
      icon: <Banknote className="h-4 w-4" />,
      tone: "success" as const,
      helper: "Efectivo asociado a factura.",
    },
    {
      label: "Servicios / remito",
      value: summary.serviciosRemito,
      icon: <Receipt className="h-4 w-4" />,
      tone: "warning" as const,
      helper: "Suma al total, no al efectivo.",
    },
    {
      label: "Point",
      value: summary.point,
      icon: <Smartphone className="h-4 w-4" />,
      tone: "info" as const,
      helper: "Cobros por terminal.",
    },
    {
      label: "Transferencias",
      value: summary.transferencia,
      icon: <Landmark className="h-4 w-4" />,
      tone: "info" as const,
      helper: "Cobros bancarios.",
    },
    {
      label: "Cuenta corriente",
      value: summary.cuentaCorriente,
      icon: <Receipt className="h-4 w-4" />,
      tone: "muted" as const,
      helper: "Impacta deuda, no caja fisica.",
    },
    {
      label: "Gastos efectivo",
      value: summary.gastosEfectivo,
      icon: <TrendingDown className="h-4 w-4" />,
      tone: "danger" as const,
      helper: "Resta al efectivo a rendir.",
    },
    {
      label: "Gastos no efectivo",
      value: summary.gastosNoEfectivo,
      icon: <TrendingDown className="h-4 w-4" />,
      tone: "muted" as const,
      helper: "No reduce el efectivo fisico.",
    },
    {
      label: "Efectivo neto",
      value: summary.efectivoNetoEsperado,
      icon: <CircleDollarSign className="h-4 w-4" />,
      tone: "success" as const,
      helper: "Efectivo esperado para rendir.",
    },
  ];

  return (
    <section className="space-y-3">
      <MetricHeroCard
        label="Total del dia"
        value={summary.total}
        helper="Ventas del dia por todos los medios de pago. Los gastos se muestran aparte para no mezclar facturacion con rendicion."
        icon={<CircleDollarSign className="h-6 w-6" />}
        breakdown={(
          <div className="rounded-2xl border border-border/55 bg-card/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Efectivo neto</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {summary.efectivoNetoEsperado.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
            </p>
          </div>
        )}
      />
      <MetricGrid>
        {cards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            helper={card.helper}
            className={card.label === "Efectivo neto" ? "xl:col-span-2" : undefined}
          />
        ))}
      </MetricGrid>
    </section>
  );
}
