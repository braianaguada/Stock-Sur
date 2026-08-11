import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const responseSchema = {
  type: "OBJECT",
  properties: {
    reference: { type: "STRING" },
    issueDate: { type: "STRING" },
    items: { type: "ARRAY", items: { type: "OBJECT", properties: { description: { type: "STRING" }, quantity: { type: "NUMBER" }, unit: { type: "STRING" }, unitPrice: { type: "NUMBER" } }, required: ["description", "quantity", "unit", "unitPrice"] } },
    globalTotal: { type: "NUMBER" },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["reference", "issueDate", "items", "globalTotal", "warnings"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("AI_SERVICE_REMITO_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const authHeader = req.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !apiKey) return json({ error: "El extractor de remitos no esta configurado." }, 503);
    if (!authHeader) return json({ error: "Falta validar la sesion actual." }, 401);
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "No se pudo validar la sesion actual." }, 401);
    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const enhancedImageBase64 = typeof body.enhancedImageBase64 === "string" ? body.enhancedImageBase64 : "";
    if (!companyId || !["image/jpeg", "image/png", "image/webp"].includes(mimeType) || !imageBase64) return json({ error: "La imagen o la empresa no son validas." }, 400);
    const { data: membership, error: membershipError } = await client.from("company_users").select("id, companies!inner(id)").eq("company_id", companyId).eq("user_id", user.id).eq("status", "ACTIVE").eq("companies.status", "ACTIVE").maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "No tenes acceso activo a esta empresa." }, 403);

    const prompt = [
      "Extrae datos del remito fotografiado. Es transcripcion estructurada, no redaccion comercial.",
      "Lee escritura manuscrita cuando sea posible y une renglones consecutivos de una misma descripcion.",
      "Ignora membretes, etiquetas impresas, sellos, firmas, identificacion fiscal, telefono y ruido visual.",
      "No inventes palabras dudosas: omitelas y agrega una advertencia.",
      "reference lleva solo el numero visible con prefijo Remito; issueDate usa YYYY-MM-DD o queda vacia.",
      "Crea items solo con trabajos o materiales. No conviertas cada renglon visual en un item.",
      "Extrae precios por item si existen. Si solo hay total final, usa globalTotal y unitPrice 0.",
      "Devuelve exclusivamente el JSON solicitado.",
    ].join("\n");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: enhancedImageBase64 ? `${prompt}\nSe adjuntan la foto original y una copia mejorada en contraste. Comparalas y conserva solo datos respaldados por ambas.` : prompt },
          { inlineData: { mimeType, data: imageBase64 } },
          ...(enhancedImageBase64 ? [{ inlineData: { mimeType: "image/jpeg", data: enhancedImageBase64 } }] : []),
        ] }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema } }),
      });
    } finally { clearTimeout(timeout); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Provider error");
    const raw = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
    if (!raw) throw new Error("Empty extraction");
    return json({ extraction: JSON.parse(raw), model });
  } catch (error) {
    console.error("service_remito_extractor_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "No se pudo interpretar el remito. Proba con una foto mas nitida y de frente." }, 502);
  }
});
