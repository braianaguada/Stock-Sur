type ItemDisplayInput = {
  name: string | null | undefined;
  attributes?: string | null | undefined;
  sku?: string | null | undefined;
};

function cleanPart(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildItemDisplayName(input: ItemDisplayInput) {
  const name = cleanPart(input.name) ?? "Item sin nombre";
  const attributes = cleanPart(input.attributes);
  return attributes ? `${name} - ${attributes}` : name;
}

export function buildItemDisplayMeta(input: ItemDisplayInput) {
  const sku = cleanPart(input.sku);
  const attributes = cleanPart(input.attributes);

  if (sku && attributes) return `${sku} · ${attributes}`;
  if (sku) return sku;
  if (attributes) return attributes;
  return "";
}
