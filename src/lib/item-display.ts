type ItemDisplayInput = {
  name: string | null | undefined;
  attributes?: string | null | undefined;
  sku?: string | null | undefined;
  brand?: string | null | undefined;
  model?: string | null | undefined;
};

function cleanPart(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildDetailParts(input: ItemDisplayInput) {
  return [
    cleanPart(input.brand),
    cleanPart(input.model),
    cleanPart(input.attributes),
  ].filter(Boolean) as string[];
}

export function buildItemDisplayName(input: ItemDisplayInput) {
  const name = cleanPart(input.name) ?? "Item sin nombre";
  const details = buildDetailParts(input);
  return details.length > 0 ? `${name} - ${details.join(" | ")}` : name;
}

export function buildItemDisplayMeta(input: ItemDisplayInput) {
  const sku = cleanPart(input.sku);
  const details = buildDetailParts(input).join(" | ");

  if (sku && details) return `${sku} | ${details}`;
  if (sku) return sku;
  if (details) return details;
  return "";
}
