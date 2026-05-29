const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BNA_RATE_ENDPOINTS = [
  "https://www.bna.com.ar/Personas",
  "https://www.bna.com.ar/Cotizador/MonedasHistorico",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeRate(value: string) {
  const digits = value.replace(/[^\d.,]/g, "");
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits.replace(/\.(?=\d{3}(?:\.|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseBnaHtmlUsdSellRate(html: string) {
  const dateMatch = html.match(/(?:Fecha:|fechaCot[^>]*>)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const rateDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
    : null;
  const rowMatch = html.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?D(?:o|\u00f3|&oacute;)lar\s+U\.?S\.?A(?:(?!<\/tr>)[\s\S])*?<\/tr>/i);
  if (!rowMatch) return null;

  const cells = Array.from(rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const rate = normalizeRate(cells[2] ?? "");
  return rate ? { rate, rateDate } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    for (const endpoint of BNA_RATE_ENDPOINTS) {
      const response = await fetch(endpoint, {
        headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      });
      if (!response.ok) continue;

      const parsed = parseBnaHtmlUsdSellRate(await response.text());
      if (parsed) {
        return json({
          source: "BNA",
          rate: parsed.rate,
          rateDate: parsed.rateDate,
          fetchedAt: new Date().toISOString(),
        });
      }
    }

    return json({ error: "Banco Nacion no devolvio una cotizacion valida." }, 502);
  } catch {
    return json({ error: "No se pudo consultar Banco Nacion." }, 502);
  }
});
