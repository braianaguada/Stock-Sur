export type ExchangeRateSnapshot = {
  source: "BNA" | "MANUAL";
  rate: number;
  rateDate: string;
  fetchedAt: string;
  label: string;
};

const BNA_RATE_ENDPOINT = "https://www.bna.com.ar/Cotizador/MonedasHistorico";
const REQUEST_TIMEOUT_MS = 6000;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeRate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
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

export async function fetchBnaOfficialUsdRate(): Promise<ExchangeRateSnapshot> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BNA_RATE_ENDPOINT, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
    if (!response.ok) throw new Error("No se pudo obtener la cotizacion Banco Nacion");

    const contentType = response.headers.get("content-type") ?? "";
    const rawPayload = contentType.includes("application/json") ? await response.json() : await response.text();
    const rate = normalizeExchangeRateResponse(rawPayload);
    if (!rate) throw new Error("La respuesta Banco Nacion no incluye una cotizacion valida");

    const fetchedAt = new Date().toISOString();
    const rateDate = todayIsoDate();
    return {
      source: "BNA",
      rate,
      rateDate,
      fetchedAt,
      label: `Banco Nacion oficial vendedor - ${rateDate}`,
    };
  } finally {
    window.clearTimeout(timeout);
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
