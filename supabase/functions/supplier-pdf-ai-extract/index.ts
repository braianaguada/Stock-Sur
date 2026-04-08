import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GeminiExtractRow = {
  supplier_code?: string;
  description?: string;
  price?: number;
  currency?: string;
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
  if (!trimmed) {
    throw new Error("Gemini no devolvio contenido.");
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La respuesta de Gemini no fue JSON valido.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function normalizeCurrency(value: unknown) {
  const raw = String(value ?? "ARS").trim().toUpperCase();
  return raw === "USD" ? "USD" : "ARS";
}

function normalizeGeminiRows(rows: unknown[]): GeminiExtractRow[] {
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const candidate = row as Record<string, unknown>;
      const description = String(candidate.description ?? "").replace(/\s+/g, " ").trim();
      const rawPrice = candidate.price;
      const price = typeof rawPrice === "number" ? rawPrice : Number.parseFloat(String(rawPrice ?? ""));
      const supplierCode = String(candidate.supplier_code ?? "").trim();

      if (!description || !Number.isFinite(price) || price <= 0) return null;

      return {
        supplier_code: supplierCode || undefined,
        description,
        price,
        currency: normalizeCurrency(candidate.currency),
      } satisfies GeminiExtractRow;
    })
    .filter((row): row is GeminiExtractRow => row !== null);
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
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64.trim() : "";

    if (!fileName || !fileBase64) {
      return json({ error: "Debes enviar fileName y fileBase64." }, 400);
    }

    if (fileBase64.length > 18_000_000) {
      return json({ error: "El PDF es demasiado grande para la extraccion asistida." }, 413);
    }

    const prompt = [
      "Extrae una lista de productos y precios desde este PDF de proveedor.",
      "Devuelve SOLO JSON valido.",
      'Formato exacto: {"lines":[{"supplier_code":"","description":"","price":0,"currency":"ARS"}],"notes":["..."]}',
      "Reglas:",
      "- Incluye solo filas que representen un producto vendible.",
      "- description debe ser el nombre del producto limpio y completo.",
      "- supplier_code puede ir vacio si no aparece.",
      '- price debe ser numerico y mayor a 0, sin separadores de miles ni simbolos.',
      '- currency debe ser "ARS" o "USD". Si el PDF no lo aclara, usa "ARS".',
      "- Ignora encabezados, subtotales, condiciones comerciales, telefonos, direcciones, observaciones e imagenes decorativas.",
      "- Si hay varias columnas de precio, prioriza precio contado o precio lista final del producto.",
      "- No inventes productos.",
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
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: fileBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                lines: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      supplier_code: { type: "STRING" },
                      description: { type: "STRING" },
                      price: { type: "NUMBER" },
                      currency: { type: "STRING" },
                    },
                    required: ["description", "price", "currency"],
                  },
                },
                notes: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
              },
              required: ["lines", "notes"],
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
    const lines = normalizeGeminiRows(Array.isArray(parsed.lines) ? parsed.lines : []);

    if (lines.length === 0) {
      return json({ error: "Gemini no encontro filas validas en el PDF." }, 422);
    }

    return json({
      lines,
      notes: Array.isArray(parsed.notes)
        ? parsed.notes.map((note) => String(note)).filter(Boolean).slice(0, 10)
        : [],
      meta: {
        model: geminiModel,
        fileName,
        userId: user.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return json({ error: message }, 500);
  }
});
