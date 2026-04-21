import { formatDateTime as formatTimestampDateTime } from "@/lib/formatters";

export const parseNonNegative = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

export const sanitizeNonNegativeDraft = (value: string) =>
  value.replace(",", ".").replace(/-/g, "");

export const formatMoney = (value: number) =>
  value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDateTime = (value: string | null) =>
  value ? formatTimestampDateTime(value) : "-";

export const formatPercentDelta = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};
