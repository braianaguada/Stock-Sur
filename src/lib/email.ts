export function buildMailtoLink(params: {
  to: string | null | undefined;
  subject?: string;
  body?: string;
}): string | null {
  const to = String(params.to ?? "").trim();
  if (!to) return null;

  const search = new URLSearchParams();
  if (params.subject) search.set("subject", params.subject);
  if (params.body) search.set("body", params.body);

  const query = search.toString();
  return query ? `mailto:${encodeURIComponent(to)}?${query}` : `mailto:${encodeURIComponent(to)}`;
}
