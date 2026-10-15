import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { number } from "../dashboard-period";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const date = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export default function DashboardPeriodChart({ buckets }: { buckets: Record<string, unknown>[] }) {
  const data = buckets.map(bucket => ({ date: String(bucket.periodStart), revenue: number(bucket.netRevenue) }));
  return <div className="h-64 w-full min-w-0" role="img" aria-label="Venta neta por fecha, en pesos argentinos; devoluciones restadas">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} accessibilityLayer margin={{ top: 10, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={date} minTickGap={24} tick={{ fontSize: 11 }} />
        <YAxis width={70} tickFormatter={value => `$${compact.format(Number(value))}`} tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={value => date(String(value))} formatter={(value: number) => [money.format(value), "Venta neta"]} />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
        <Bar dataKey="revenue" name="Venta neta" fill="hsl(var(--primary))" maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
