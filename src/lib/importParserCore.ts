export interface ParsedRow {
  [key: string]: string;
}

export function normalizeNumberString(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  let clean = trimmed
    .replace(/\s+/g, "")
    .replace(/[\u00A0\u202F]/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!clean) return "";

  const hasComma = clean.includes(",");
  const hasDot = clean.includes(".");

  if (hasComma && hasDot) {
    const lastComma = clean.lastIndexOf(",");
    const lastDot = clean.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";

    if (decimalSeparator === ",") {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }

    return clean;
  }

  if (hasComma) {
    const commaCount = (clean.match(/,/g) ?? []).length;
    if (commaCount > 1) {
      const parts = clean.split(",");
      const decimal = parts.pop() ?? "";
      clean = `${parts.join("")}.${decimal}`;
    } else {
      clean = clean.replace(",", ".");
    }
  }

  if (hasDot) {
    const dotCount = (clean.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      const parts = clean.split(".");
      const decimal = parts.pop() ?? "";
      clean = `${parts.join("")}.${decimal}`;
    }
  }

  return clean;
}

export function parsePrice(value: string): number {
  const normalized = normalizeNumberString(value);
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isRowEmpty(row: ParsedRow): boolean {
  return Object.values(row).every((val) => !String(val ?? "").trim());
}
