import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardView } from "@/features/index/dashboard-view-model";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const month = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });
const seriesColors = ["hsl(var(--brand-indigo))", "hsl(var(--brand-cyan))"];

function formatMonthLabel(label: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return label;

  return month
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
    .replace(".", "");
}

export function DashboardHeroChart({ view }: { view: DashboardView }) {
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>();

    view.series.forEach((chartSeries) => {
      chartSeries.points.forEach((point) => {
        const row = rows.get(point.label) ?? { label: formatMonthLabel(point.label) };
        row[chartSeries.key] = point.value;
        rows.set(point.label, row);
      });
    });

    return [...rows.values()];
  }, [view]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      {view.key === "inventory" ? (
        <BarChart data={chartData} accessibilityLayer margin={{ top: 12, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="hsl(var(--border) / .45)" vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis hide />
          <Tooltip formatter={(value: number) => currency.format(value)} />
          <Bar
            dataKey={view.series[0].key}
            name={view.series[0].label}
            fill="hsl(var(--brand-cyan))"
            radius={[8, 8, 3, 3]}
          />
        </BarChart>
      ) : (
        <AreaChart data={chartData} accessibilityLayer margin={{ top: 12, right: 10, left: 0, bottom: 4 }}>
          <defs>
            {view.series.map((chartSeries, index) => (
              <linearGradient
                key={chartSeries.key}
                id={`hero-fill-${chartSeries.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={seriesColors[index]} stopOpacity=".38" />
                <stop offset="100%" stopColor={seriesColors[index]} stopOpacity=".03" />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="hsl(var(--border) / .45)" vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis hide />
          <Tooltip formatter={(value: number) => currency.format(value)} />
          {view.series.length > 1 ? <Legend /> : null}
          {view.series.map((chartSeries, index) => (
            <Area
              key={chartSeries.key}
              type="monotone"
              dataKey={chartSeries.key}
              name={chartSeries.label}
              stroke={seriesColors[index]}
              strokeWidth={2.5}
              fill={`url(#hero-fill-${chartSeries.key})`}
            />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
