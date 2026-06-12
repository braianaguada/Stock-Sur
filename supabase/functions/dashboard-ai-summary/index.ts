import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractSummary(rawText: string) {
  const match = rawText.trim().match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match?.[0] ?? rawText) as { summary?: unknown };
  return typeof parsed.summary === "string" ? parsed.summary.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !authHeader) return json({ error: "No se pudo validar la sesion." }, 401);
    if (!geminiApiKey) return json({ error: "El resumen IA no esta configurado." }, 503);

    const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await actorClient.auth.getUser();
    if (!user) return json({ error: "No se pudo validar la sesion." }, 401);

    const body = await req.json().catch(() => ({}));
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "la empresa";
    const snapshot = body.snapshot && typeof body.snapshot === "object" ? body.snapshot : {};
    const prompt = [
      `Actua como analista operativo de ${companyName}.`,
      "Resume el estado del negocio usando exclusivamente el snapshot calculado por el sistema.",
      "Prioriza tendencias, riesgos y oportunidades. No inventes causas ni datos.",
      "Incluye hasta 3 acciones concretas. Maximo 130 palabras.",
      'Devuelve SOLO JSON valido con formato {"summary":"..."}.',
      JSON.stringify(snapshot),
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 320,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: { summary: { type: "STRING" } },
              required: ["summary"],
            },
          },
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: payload?.error?.message ?? "La IA no pudo generar el resumen." }, response.status);

    const rawText = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text ?? "";
    const summary = extractSummary(rawText);
    if (!summary) return json({ error: "La IA no devolvio un resumen valido." }, 422);
    return json({ summary, meta: { model: geminiModel } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});
