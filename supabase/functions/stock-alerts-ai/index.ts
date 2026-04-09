import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error("Gemini no devolvio contenido.");

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La respuesta de Gemini no fue JSON valido.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

type CandidateRow = {
  itemId?: string;
  itemName?: string;
  sku?: string;
  unit?: string;
  total?: number;
  health?: string;
  demandProfile?: string;
  lowRotation?: boolean;
  daysOfCover?: number | null;
  monthsOfCoverLowRotation?: number | null;
  avgDailyOut30?: number;
  avgDailyOut90?: number;
  avgDailyOut365?: number;
  demandDaily?: number;
  demandMonthlyEstimate?: number | null;
};

function normalizeRows(value: unknown): CandidateRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const candidate = row as Record<string, unknown>;
      const itemId = String(candidate.itemId ?? "").trim();
      const itemName = String(candidate.itemName ?? "").trim();
      if (!itemId || !itemName) return null;

      return {
        itemId,
        itemName,
        sku: String(candidate.sku ?? "").trim(),
        unit: String(candidate.unit ?? "").trim(),
        total: Number(candidate.total ?? 0),
        health: String(candidate.health ?? "").trim(),
        demandProfile: String(candidate.demandProfile ?? "").trim(),
        lowRotation: candidate.lowRotation === true,
        daysOfCover: candidate.daysOfCover === null ? null : Number(candidate.daysOfCover ?? 0),
        monthsOfCoverLowRotation:
          candidate.monthsOfCoverLowRotation === null ? null : Number(candidate.monthsOfCoverLowRotation ?? 0),
        avgDailyOut30: Number(candidate.avgDailyOut30 ?? 0),
        avgDailyOut90: Number(candidate.avgDailyOut90 ?? 0),
        avgDailyOut365: Number(candidate.avgDailyOut365 ?? 0),
        demandDaily: Number(candidate.demandDaily ?? 0),
        demandMonthlyEstimate:
          candidate.demandMonthlyEstimate === null ? null : Number(candidate.demandMonthlyEstimate ?? 0),
      } satisfies CandidateRow;
    })
    .filter((row): row is CandidateRow => row !== null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Faltan secretos base de Supabase." }, 500);
    }

    if (!geminiApiKey) {
      return json({ error: "La Edge Function no tiene configurado GEMINI_API_KEY." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Falta el header Authorization." }, 401);
    }

    const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await actorClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "No se pudo validar la sesion actual." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "la empresa";
    const rows = normalizeRows(body.rows);
    if (rows.length === 0) {
      return json({ error: "Debes enviar filas de stock para analizar." }, 400);
    }

    const prompt = [
      `Analiza el snapshot de stock de ${companyName}.`,
      "Tu tarea es devolver alertas accionables y priorizadas para el equipo operativo.",
      "Devuelve SOLO JSON valido.",
      'Formato exacto: {"summary":"...","alerts":[{"itemId":"","kind":"LOW_COVERAGE","tone":"YELLOW","priority":80,"title":"","detail":"","suggestedAction":""}]}',
      "Reglas:",
      "- Devuelve entre 4 y 12 alertas maximo.",
      "- Prioriza riesgo de quiebre, aceleracion de demanda, sobrestock y stock inmovilizado.",
      '- Usa solo los tonos: "RED", "YELLOW", "BLUE", "GRAY".',
      '- Usa solo los kinds: "STOCKOUT", "LOW_COVERAGE", "DEMAND_SPIKE", "OVERSTOCK", "DORMANT_STOCK", "NO_SIGNAL".',
      "- No inventes productos ni datos que no esten en el snapshot.",
      "- No repitas el mismo item mas de una vez salvo que sea absolutamente necesario; en general, una alerta por item.",
      "- detail debe explicar por que el item entro en alerta usando los numeros enviados.",
      "- suggestedAction debe ser concreta y operativa.",
      "- priority debe ser un numero de 1 a 100.",
      "",
      "Snapshot:",
      JSON.stringify(rows),
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                summary: { type: "STRING" },
                alerts: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      itemId: { type: "STRING" },
                      kind: { type: "STRING" },
                      tone: { type: "STRING" },
                      priority: { type: "NUMBER" },
                      title: { type: "STRING" },
                      detail: { type: "STRING" },
                      suggestedAction: { type: "STRING" },
                    },
                    required: ["itemId", "kind", "tone", "priority", "title", "detail", "suggestedAction"],
                  },
                },
              },
              required: ["summary", "alerts"],
            },
          },
        }),
      },
    );

    const geminiPayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof geminiPayload?.error?.message === "string"
          ? geminiPayload.error.message
          : "Gemini devolvio un error.";
      return json({ error: message }, response.status);
    }

    const rawText =
      geminiPayload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")
        ?.text ?? "";

    const parsed = extractJsonPayload(rawText);
    const alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
    if (alerts.length === 0) {
      return json({ error: "Gemini no devolvio alertas validas." }, 422);
    }

    return json({
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      alerts,
      meta: {
        model: geminiModel,
        userId: user.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return json({ error: message }, 500);
  }
});
