export function cleanText(v: unknown): string {
  if (v === null || v === undefined) return "";

  const s = String(v).trim().replace(/\s+/g, " ");
  const low = s.toLowerCase();

  if (!s || low === "nan" || low === "null" || low === "undefined") {
    return "";
  }

  return s;
}

export function normalizeAlias(value: unknown): string {
  return cleanText(value).toLowerCase();
}
