import { Banknote, CircleDollarSign, Landmark, Receipt, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import type { CashSummary } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
};

const toneClasses = {
  remito: "from-card via-card to-success/12 before:bg-success/75",
  facturable: "from-card via-card to-lime-500/12 before:bg-lime-500/80",
  servicios: "from-card via-card to-warning/14 before:bg-warning/80",
  info: "from-card via-card to-info/12 before:bg-info/75",
  account: "from-card via-card to-warning/14 before:bg-warning/80",
  total: "from-card via-card to-primary/10 before:bg-primary/75",
} as const;

const iconClasses = {
  remito: "border-success/18 bg-success/10 text-success",
  facturable: "border-lime-500/18 bg-lime-500/10 text-lime-600 dark:text-lime-400",
  servicios: "border-warning/18 bg-warning/12 text-warning",
  info: "border-info/18 bg-info/12 text-info",
  account: "border-warning/18 bg-warning/12 text-warning",
  total: "border-primary/18 bg-primary/10 text-primary",
} as const;

export function CashSummaryCards({ summary }: CashSummaryCardsProps) {
  const cards = [
    {
      label: "Efectivo remito",
      value: summary.efectivoRemito,
      icon: <Banknote className="h-4 w-4" />,
      tone: "remito" as const,
    },
    {
      label: "Efectivo facturable",
      value: summary.efectivoFacturable,
      icon: <Banknote className="h-4 w-4" />,
      tone: "facturable" as const,
    },
    {
      label: "Servicios / remito",
      value: summary.serviciosRemito,
      icon: <Receipt className="h-4 w-4" />,
      tone: "servicios" as const,
    },
    {
      label: "Point",
      value: summary.point,
      icon: <Smartphone className="h-4 w-4" />,
      tone: "info" as const,
    },
    {
      label: "Transferencias",
      value: summary.transferencia,
      icon: <Landmark className="h-4 w-4" />,
      tone: "info" as const,
    },
    {
      label: "Cuenta corriente",
      value: summary.cuentaCorriente,
      icon: <Receipt className="h-4 w-4" />,
      tone: "account" as const,
    },
    {
      label: "Total del día",
      value: summary.total,
      icon: <CircleDollarSign className="h-4 w-4" />,
      tone: "total" as const,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => {
        const formattedValue = currency.format(card.value);
        const valueClassName =
          formattedValue.length >= 13
            ? "text-[1.22rem] md:text-[1.35rem] 2xl:text-[1.28rem]"
            : formattedValue.length >= 11
              ? "text-[1.4rem] md:text-[1.52rem] 2xl:text-[1.42rem]"
              : formattedValue.length >= 10
                ? "text-[1.56rem] md:text-[1.7rem] 2xl:text-[1.58rem]"
                : "text-[1.85rem]";

        return (
          <Card
            key={card.label}
            className={`relative overflow-hidden bg-gradient-to-br ${toneClasses[card.tone]} before:absolute before:inset-x-5 before:top-0 before:h-px shadow-[var(--shadow-xs)] ${card.label === "Total del día" ? "xl:col-span-2 2xl:col-span-1" : ""}`}
          >
            <CardContent className="px-5 py-7 text-center">
              <div className="grid min-h-[156px] place-items-center">
                <div className="flex w-full min-w-0 max-w-[16rem] flex-col items-center justify-center gap-3 overflow-hidden">
                  <div
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border shadow-[var(--shadow-xs)] ${iconClasses[card.tone]}`}
                  >
                    {card.icon}
                  </div>
                  <div className="w-full space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {card.label}
                    </p>
                    <div
                      className={`mx-auto max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-none tracking-[-0.045em] text-foreground [font-variant-numeric:tabular-nums] ${valueClassName}`}
                    >
                      {formattedValue}
                    </div>
                  </div>
                  {card.hint ? (
                    <p className="max-w-[18ch] text-sm leading-5 text-muted-foreground">{card.hint}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
