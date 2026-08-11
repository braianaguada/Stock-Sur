import type { ServiceCustomer, ServiceDocumentLine } from "./types";

export type ServiceRemitoImport = {
  reference: string;
  issueDate: string | null;
  customerName: string | null;
  lines: ServiceDocumentLine[];
  globalTotal: number | null;
  netTotal: number | null;
  taxRate: number | null;
  taxTotal: number | null;
};

const TECHNICAL_TOKENS = new Set(["aa/cc", "btu", "cuit", "hp", "iva", "r410", "sku", "upc"]);

function normalizeImportedDescription(value: string) {
  const source = value.trim().replace(/\s+/g, " ");
  if (!source) return "";
  const sourceTokens = source.match(/[\p{L}\d]+(?:[./-][\p{L}\d]+)*/gu) ?? [];
  let normalized = source.toLocaleLowerCase("es-AR");
  for (const token of sourceTokens) {
    const lower = token.toLocaleLowerCase("es-AR");
    if (TECHNICAL_TOKENS.has(lower) || /\d/.test(token)) {
      normalized = normalized.replace(new RegExp(lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), token.toUpperCase());
    }
  }
  normalized = normalized.charAt(0).toLocaleUpperCase("es-AR") + normalized.slice(1);
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function normalizeCustomerName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findImportedCustomerId(customerName: string | null, customers: ServiceCustomer[]) {
  if (!customerName) return null;
  const candidate = normalizeCustomerName(customerName);
  if (!candidate || ["cliente", "cliente ocasional", "consumidor final", "sin cliente"].includes(candidate)) return null;
  const exact = customers.filter((customer) => normalizeCustomerName(customer.name) === candidate);
  if (exact.length === 1) return exact[0].id;
  if (candidate.length < 4) return null;
  const contained = customers.filter((customer) => {
    const name = normalizeCustomerName(customer.name);
    return name.length >= 4 && (name.includes(candidate) || candidate.includes(name));
  });
  return contained.length === 1 ? contained[0].id : null;
}

export function parseStructuredServiceRemito(value: unknown): ServiceRemitoImport {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const lines = rawItems.flatMap((rawItem, index) => {
    if (!rawItem || typeof rawItem !== "object") return [];
    const item = rawItem as Record<string, unknown>;
    const rawDescription = typeof item.description === "string" ? item.description.trim() : "";
    if (rawDescription.length < 3) return [];
    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    const unitPrice = typeof item.unitPrice === "number" && item.unitPrice >= 0 ? item.unitPrice : 0;
    const declaredType = item.lineType === "TITLE" || item.lineType === "SUBTITLE" || item.lineType === "ITEM" ? item.lineType : null;
    const looksLikeTitle = index === 0 && rawItems.length > 1 && rawDescription.length <= 100 && rawDescription === rawDescription.toLocaleUpperCase("es-AR");
    const lineType = declaredType ?? (looksLikeTitle ? "TITLE" : "ITEM");
    const descriptions = lineType === "ITEM" && unitPrice === 0 && quantity === 1
      ? rawDescription.split(/(?<=[.!?])\s+(?=[\p{L}\d])/u)
      : [rawDescription];
    return descriptions.map((description) => ({
      description: normalizeImportedDescription(description),
      quantity: lineType === "ITEM" ? quantity : null,
      unit: lineType === "ITEM" ? (typeof item.unit === "string" && item.unit.trim() ? item.unit.trim() : "serv") : null,
      unit_price: lineType === "ITEM" ? unitPrice : null,
      line_total: lineType === "ITEM" ? quantity * unitPrice : 0,
      sort_order: 0,
      line_type: lineType,
      is_bold: lineType === "TITLE",
    } satisfies ServiceDocumentLine));
  }).map((line, index) => ({ ...line, sort_order: index + 1 }));
  return {
    reference: typeof input.reference === "string" ? input.reference.trim() : "",
    issueDate: typeof input.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.issueDate) ? input.issueDate : null,
    customerName: typeof input.customerName === "string" && input.customerName.trim() ? input.customerName.trim() : null,
    lines,
    globalTotal: typeof input.globalTotal === "number" && input.globalTotal > 0 ? input.globalTotal : null,
    netTotal: typeof input.netTotal === "number" && input.netTotal > 0 ? input.netTotal : null,
    taxRate: typeof input.taxRate === "number" && input.taxRate > 0 ? input.taxRate : null,
    taxTotal: typeof input.taxTotal === "number" && input.taxTotal > 0 ? input.taxTotal : null,
  };
}

function parseMoney(raw: string) {
  const normalized = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function isoDate(day: string, month: string, year: string) {
  const fullYear = year.length === 2 ? `20${year}` : year;
  const date = new Date(Number(fullYear), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(fullYear) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseServiceRemitoText(text: string): ServiceRemitoImport {
  const normalized = text.replace(/\r/g, "");
  const referenceMatch = normalized.match(/(?:N[°ºo]?|remito|comprobante)\s*[:#-]?\s*([0-9]{2,})/i);
  const dateMatch = normalized.match(/(?:fecha\s*[:.-]?\s*)?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i);
  const totalMatches = [...normalized.matchAll(/(?:total|importe)\s*[:$ ]*([0-9][0-9.,]*)/gi)];
  const globalTotal = totalMatches.length ? parseMoney(totalMatches.at(-1)?.[1] ?? "") : null;
  const ignored = /^(fecha|cliente|direcci[oó]n|tel[eé]fono|cant(?:idad)?|descripci[oó]n|precio|unitario|subtotal|itbms|iva|total|firma|recibido|r\.?u\.?c)/i;

  const candidates = normalized.split("\n").map((value) => value.trim()).filter((value) => {
    if (value.length < 4 || ignored.test(value)) return false;
    if (referenceMatch?.[0] && value.includes(referenceMatch[0])) return false;
    if (dateMatch?.[0] && value.includes(dateMatch[0])) return false;
    const letters = (value.match(/[a-záéíóúñ]/gi) ?? []).length;
    return letters >= 3 && letters / value.length >= 0.35;
  });

  const lines = candidates.map((description, index) => {
    const priceMatch = description.match(/(?:\$|usd|ars)\s*([0-9][0-9.,]*)\s*$/i);
    const unitPrice = priceMatch ? parseMoney(priceMatch[1]) : null;
    const cleanDescription = priceMatch ? description.slice(0, priceMatch.index).trim() : description;
    return {
      description: cleanDescription,
      quantity: 1,
      unit: "serv",
      unit_price: unitPrice ?? 0,
      line_total: unitPrice ?? 0,
      sort_order: index + 1,
      line_type: "ITEM" as const,
    } satisfies ServiceDocumentLine;
  }).filter((line) => line.description.length >= 4);

  return {
    reference: referenceMatch ? `Remito ${referenceMatch[1]}` : "",
    issueDate: dateMatch ? isoDate(dateMatch[1], dateMatch[2], dateMatch[3]) : null,
    customerName: null,
    lines,
    globalTotal,
    netTotal: null,
    taxRate: null,
    taxTotal: null,
  };
}
