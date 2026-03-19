import { Banknote, CircleDollarSign, Landmark, Receipt, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import type { CashSummary } from "../types";

type CashSummaryCardsProps = {
  summary: CashSummary;
};

export function CashSummaryCards({ summary }: CashSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card className="border-emerald-300 bg-emerald-100">
        <CardHeader className="pb-3">
          <CardDescription>Efectivo</CardDescription>
          <CardTitle className="flex items-center gap-2 text-emerald-900"><Banknote className="h-4 w-4" /> {currency.format(summary.efectivo)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-sky-300 bg-sky-100">
        <CardHeader className="pb-3">
          <CardDescription>Point</CardDescription>
          <CardTitle className="flex items-center gap-2 text-sky-900"><Smartphone className="h-4 w-4" /> {currency.format(summary.point)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-violet-300 bg-violet-100">
        <CardHeader className="pb-3">
          <CardDescription>Transferencias</CardDescription>
          <CardTitle className="flex items-center gap-2 text-violet-900"><Landmark className="h-4 w-4" /> {currency.format(summary.transferencia)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-amber-300 bg-amber-100">
        <CardHeader className="pb-3">
          <CardDescription>Cuenta corriente</CardDescription>
          <CardTitle className="flex items-center gap-2 text-amber-900"><Receipt className="h-4 w-4" /> {currency.format(summary.cuentaCorriente)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-slate-300 bg-slate-100">
        <CardHeader className="pb-3">
          <CardDescription>Total del dia</CardDescription>
          <CardTitle className="flex items-center gap-2 text-slate-900"><CircleDollarSign className="h-4 w-4" /> {currency.format(summary.total)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{summary.pendientes} pendientes de comprobante</p>
        </CardContent>
      </Card>
    </div>
  );
}
