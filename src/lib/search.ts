function normalizeSearchText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/+\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchIncludes(haystack: string, query: string) {
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizedHaystack.includes(normalizedQuery);
}

