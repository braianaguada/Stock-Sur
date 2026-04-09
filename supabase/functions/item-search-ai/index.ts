import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Candidate = {
  itemId?: string;
  sku?: string;
  name?: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  aliases?: string[];
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

function normalizeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const itemId = String(candidate.itemId ?? "").trim();
      const name = String(candidate.name ?? "").trim();
      if (!itemId || !name) return null;

      return {
        itemId,
        sku: String(candidate.sku ?? "").trim(),
        name,
        brand: String(candidate.brand ?? "").trim() || null,
        model: String(candidate.model ?? "").trim() || null,
        category: String(candidate.category ?? "").trim() || null,
        aliases: Array.isArray(candidate.aliases)
          ? candidate.aliases.map((alias) => String(alias).trim()).filter(Boolean).slice(0, 6)
          : [],
      } satisfies Candidate;
    })
    .filter((entry): entry is Candidate => entry !== null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_SEARCH_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

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
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const candidates = normalizeCandidates(body.candidates);

    if (!query) {
      return json({ error: "Debes enviar una consulta." }, 400);
    }

    if (candidates.length === 0) {
      return json({ matchedItemIds: [], meta: { model: geminiModel, userId: user.id } });
    }

    const prompt = [
      "Sos un motor de busqueda de productos para una app de stock.",
      "Recibis una consulta del usuario y una lista acotada de candidatos.",
      "Tu tarea es devolver solo los itemId que realmente coinciden con la intencion de busqueda.",
      "Podes considerar equivalencias, abreviaturas, errores menores de tipeo y lenguaje comercial.",
      "No inventes ids ni devuelvas productos que no sean relevantes.",
      "Si nada coincide, devolve una lista vacia.",
      "Devuelve SOLO JSON valido.",
      'Formato exacto: {"matchedItemIds":["id1","id2"]}',
      "",
      `Consulta: ${query}`,
      `Candidatos: ${JSON.stringify(candidates)}`,
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
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                matchedItemIds: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
              },
              required: ["matchedItemIds"],
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
    const candidateIds = new Set(candidates.map((candidate) => candidate.itemId));
    const matchedItemIds = Array.isArray(parsed.matchedItemIds)
      ? parsed.matchedItemIds.map((value) => String(value).trim()).filter((itemId) => candidateIds.has(itemId))
      : [];

    return json({
      matchedItemIds,
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
