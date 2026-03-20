export const parseNonNegative = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

export const parseNullableNonNegative = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

export const sanitizeNonNegativeDraft = (value: string) => value.replace(",", ".").replace(/-/g, "");
