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

type CandidateAlert = {
  itemName?: string;
  tone?: string;
  kind?: string;
  priority?: number;
  title?: string;
  detail?: string;
  suggestedAction?: string;
};

function normalizeAlerts(value: unknown): CandidateAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((alert) => {
      if (!alert || typeof alert !== "object") return null;
      const candidate = alert as Record<string, unknown>;
      const itemName = String(candidate.itemName ?? "").trim();
      const title = String(candidate.title ?? "").trim();
      const detail = String(candidate.detail ?? "").trim();
      const suggestedAction = String(candidate.suggestedAction ?? "").trim();
      if (!itemName || !title || !detail || !suggestedAction) return null;

      return {
        itemName,
        tone: String(candidate.tone ?? "").trim(),
        kind: String(candidate.kind ?? "").trim(),
        priority: Number(candidate.priority ?? 0),
        title,
        detail,
        suggestedAction,
      } satisfies CandidateAlert;
    })
    .filter((alert): alert is CandidateAlert => alert !== null)
    .slice(0, 12);
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
    const alerts = normalizeAlerts(body.alerts);
    if (alerts.length === 0) {
      return json({ error: "Debes enviar alertas operativas para resumir." }, 400);
    }

    const prompt = [
      `Resume las alertas operativas de stock de ${companyName}.`,
      "Las alertas ya fueron calculadas por reglas deterministicas. No las recalcules ni agregues alertas nuevas.",
      "Redacta un resumen ejecutivo breve, claro y accionable para el equipo operativo.",
      "Devuelve SOLO JSON valido.",
      'Formato exacto: {"summary":"..."}',
      "Reglas:",
      "- Usa solo la informacion enviada.",
      "- Menciona primero los riesgos mas prioritarios.",
      "- Incluye como maximo 3 acciones concretas.",
      "- No superes 100 palabras.",
      "",
      "Alertas operativas:",
      JSON.stringify(alerts),
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
            maxOutputTokens: 250,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                summary: { type: "STRING" },
              },
              required: ["summary"],
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
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!summary) {
      return json({ error: "Gemini no devolvio un resumen valido." }, 422);
    }

    return json({
      summary,
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
