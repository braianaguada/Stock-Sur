import type { ServiceDocumentLine } from "./types";

export type ServiceRemitoImport = {
  reference: string;
  issueDate: string | null;
  lines: ServiceDocumentLine[];
  globalTotal: number | null;
};

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
    lines,
    globalTotal,
  };
}
