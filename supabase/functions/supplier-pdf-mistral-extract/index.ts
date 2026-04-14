import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExtractRow = {
  supplier_code?: string;
  description?: string;
  price?: number;
  currency?: string;
  page?: number;
  confidence?: number;
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

function normalizeCurrency(value: unknown) {
  const raw = String(value ?? "ARS").trim().toUpperCase();
  return raw === "USD" ? "USD" : "ARS";
}

function normalizeRows(rows: unknown[]): ExtractRow[] {
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const candidate = row as Record<string, unknown>;
      const description = String(candidate.description ?? "").replace(/\s+/g, " ").trim();
      const rawPrice = candidate.price;
      const price = typeof rawPrice === "number" ? rawPrice : Number.parseFloat(String(rawPrice ?? ""));
      const supplierCode = String(candidate.supplier_code ?? "").trim();
      const page = Number(candidate.page ?? 0);
      const confidence = Number(candidate.confidence ?? 0);

      if (!description || !Number.isFinite(price) || price <= 0) return null;

      return {
        supplier_code: supplierCode || undefined,
        description,
        price,
        currency: normalizeCurrency(candidate.currency),
        page: Number.isFinite(page) && page > 0 ? Math.trunc(page) : undefined,
        confidence: Number.isFinite(confidence) && confidence > 0 ? Math.max(0.1, Math.min(0.99, confidence)) : undefined,
      } satisfies ExtractRow;
    })
    .filter((row): row is ExtractRow => row !== null);
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            supplier_code: { type: "string", description: "Supplier product code when present. Empty string if missing." },
            description: { type: "string", description: "Clean product name. Exclude headers, discount notes and technical comparison tables." },
            price: { type: "number", description: "Final unit price for the product." },
            currency: { type: "string", enum: ["ARS", "USD"] },
            page: { type: "integer", description: "1-based page number of the source item." },
            confidence: { type: "number", description: "Confidence score from 0 to 1 for this extracted product line." },
          },
          required: ["description", "price", "currency", "page"],
        },
      },
    },
    required: ["lines"],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
    const mistralModel = Deno.env.get("MISTRAL_OCR_MODEL") ?? "mistral-ocr-latest";

    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Faltan secretos base de Supabase." }, 500);
    }
    if (!mistralApiKey) {
      return json({ error: "La Edge Function no tiene configurado MISTRAL_API_KEY." }, 503);
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

    const response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mistralApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: mistralModel,
        document: {
          type: "document_url",
          document_url: `data:application/pdf;base64,${fileBase64}`,
        },
        document_annotation_prompt: [
          "Extract only a supplier product list from this document.",
          "Return only sellable product rows.",
          "Ignore headers, footers, phone numbers, emails, dates, discounts, stock labels, images, dimension tables and technical comparison tables.",
          "For each valid row return supplier_code, description, price, currency and source page.",
          "If the currency is not explicit use ARS by default.",
          "If a page contains both a product list and a technical table, extract only the product list.",
        ].join(" "),
        document_annotation_format: {
          type: "json_schema",
          json_schema: {
            name: "supplier_catalog_lines",
            schema: buildSchema(),
          },
        },
        table_format: "html",
        extract_header: true,
        extract_footer: true,
        confidence_scores_granularity: "page",
        include_image_base64: false,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof payload?.message === "string"
          ? payload.message
          : typeof payload?.error === "string"
            ? payload.error
            : "Mistral OCR devolvio un error.";
      return json({ error: message }, response.status);
    }

    const annotation = payload?.document_annotation;
    let parsedAnnotation: Record<string, unknown> | null = null;
    if (annotation && typeof annotation === "object") {
      parsedAnnotation = annotation as Record<string, unknown>;
    } else if (typeof annotation === "string") {
      parsedAnnotation = JSON.parse(annotation) as Record<string, unknown>;
    }

    const lines = normalizeRows(Array.isArray(parsedAnnotation?.lines) ? parsedAnnotation.lines : []);
    if (lines.length === 0) {
      return json({ error: "Mistral no encontro filas validas en el PDF." }, 422);
    }

    return json({
      lines,
      meta: {
        model: payload?.model ?? mistralModel,
        fileName,
        pageCount: Array.isArray(payload?.pages) ? payload.pages.length : null,
        userId: user.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return json({ error: message }, 500);
  }
});
