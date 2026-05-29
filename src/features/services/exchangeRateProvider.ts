import { supabase } from "@/integrations/supabase/client";

export type ExchangeRateSnapshot = {
  source: "BNA" | "MANUAL";
  rate: number;
  rateDate: string;
  fetchedAt: string;
  label: string;
};

const BNA_RATE_ENDPOINTS = [
  "https://www.bna.com.ar/Personas",
  "https://www.bna.com.ar/Cotizador/MonedasHistorico",
];
const REQUEST_TIMEOUT_MS = 6000;
const AUTO_RATE_ERROR = "No se pudo obtener la cotizacion automaticamente. Cargala manualmente.";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeRate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d.,]/g, "");
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits.replace(/\.(?=\d{3}(?:\.|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeExchangeRateResponse(payload: unknown): number | null {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const rate = normalizeExchangeRateResponse(item);
      if (rate) return rate;
    }
    return null;
  }
  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidateKeys = ["venta", "Venta", "vendedor", "cotizacion", "Cotizacion", "rate"];
    for (const key of candidateKeys) {
      const rate = normalizeRate(record[key]);
      if (rate) return rate;
    }
    for (const value of Object.values(record)) {
      const rate = normalizeExchangeRateResponse(value);
      if (rate) return rate;
    }
  }
  return normalizeRate(payload);
}

export function parseBnaHtmlUsdSellRate(html: string): { rate: number; rateDate: string | null } | null {
  const dateMatch = html.match(/(?:Fecha:|fechaCot[^>]*>)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const rateDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
    : null;
  const rowMatch = html.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?D(?:o|\u00f3|&oacute;)lar\s+U\.?S\.?A(?:(?!<\/tr>)[\s\S])*?<\/tr>/i);
  if (!rowMatch) return null;

  const cells = Array.from(rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const rate = normalizeRate(cells[2]);
  return rate ? { rate, rateDate } : null;
}

export function normalizeBnaRatePayload(payload: unknown): { rate: number; rateDate: string | null } | null {
  if (typeof payload === "string") return parseBnaHtmlUsdSellRate(payload);
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const rate = normalizeExchangeRateResponse(record.rate ?? record.venta ?? record.sellRate ?? record);
    const rateDate = typeof record.rateDate === "string" ? record.rateDate : null;
    return rate ? { rate, rateDate } : null;
  }
  const rate = normalizeExchangeRateResponse(payload);
  return rate ? { rate, rateDate: null } : null;
}

export async function fetchBnaOfficialUsdRate(): Promise<ExchangeRateSnapshot> {
  const { data, error } = await supabase.functions.invoke("bna-exchange-rate");
  if (!error) {
    const normalized = normalizeBnaRatePayload(data);
    if (normalized?.rate) {
      const fetchedAt = new Date().toISOString();
      const rateDate = normalized.rateDate ?? todayIsoDate();
      return {
        source: "BNA",
        rate: normalized.rate,
        rateDate,
        fetchedAt,
        label: `Banco Nacion oficial vendedor - ${rateDate}`,
      };
    }
  }

  return fetchBnaOfficialUsdRateDirect();
}

async function fetchBnaOfficialUsdRateDirect(): Promise<ExchangeRateSnapshot> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    for (const endpoint of BNA_RATE_ENDPOINTS) {
      const response = await fetch(endpoint, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
      });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "";
      const rawPayload = contentType.includes("application/json") ? await response.json() : await response.text();
      const normalized = normalizeBnaRatePayload(rawPayload);
      if (normalized?.rate) {
        const fetchedAt = new Date().toISOString();
        const rateDate = normalized.rateDate ?? todayIsoDate();
        return {
          source: "BNA",
          rate: normalized.rate,
          rateDate,
          fetchedAt,
          label: `Banco Nacion oficial vendedor - ${rateDate}`,
        };
      }
    }
    throw new Error("La respuesta Banco Nacion no incluye una cotizacion valida");
  } catch {
    throw new Error(AUTO_RATE_ERROR);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function getManualExchangeRateSnapshot(rate: number, rateDate = todayIsoDate()): ExchangeRateSnapshot {
  return {
    source: "MANUAL",
    rate,
    rateDate,
    fetchedAt: new Date().toISOString(),
    label: `Cotizacion manual - ${rateDate}`,
  };
}
