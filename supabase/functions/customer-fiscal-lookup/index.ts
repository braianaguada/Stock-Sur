import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AFIPSDK_BASE_URL,
  AFIPSDK_ENVIRONMENT,
  buildAfipSdkAuthPayload,
  buildAfipSdkPadronPayload,
  extractFiscalLookupData,
  getCuitValidationMessage,
  normalizeAfipSdkBaseUrl,
  normalizeCuit,
  normalizeFiscalLookupError,
  sanitizeProviderPayload,
} from "./logic.ts";

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

function getBearerToken(authHeader: string | null) {
  const value = authHeader ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

async function postAfipSdk(baseUrl: string, path: string, accessToken: string, body: unknown) {
  const res = await fetch(new URL(path, baseUrl).toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const message = typeof payload === "object" && payload && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Afip SDK respondio HTTP ${res.status}`;
    const error = new Error(message);
    (error as Error & { providerResponse?: unknown; status?: number }).providerResponse = payload;
    (error as Error & { providerResponse?: unknown; status?: number }).status = res.status;
    throw error;
  }

  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const afipSdkAccessToken = Deno.env.get("AFIPSDK_ACCESS_TOKEN");
  const afipSdkBaseUrl = normalizeAfipSdkBaseUrl(Deno.env.get("AFIPSDK_BASE_URL") ?? AFIPSDK_BASE_URL);

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Faltan secretos requeridos de Supabase." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!getBearerToken(authHeader)) return json({ error: "Falta el header Authorization." }, 401);

  const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });
  const { data: { user }, error: userError } = await actorClient.auth.getUser();
  if (userError || !user) return json({ error: "No se pudo validar la sesion actual." }, 401);

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const taxId = normalizeCuit(typeof body.taxId === "string" ? body.taxId : "");
  if (!customerId) return json({ error: "Debes indicar el cliente a validar." }, 400);

  const taxIdError = getCuitValidationMessage(taxId);
  if (taxIdError) return json({ error: taxIdError }, 400);

  const { data: customer, error: customerError } = await serviceClient
    .from("customers")
    .select("id, company_id, name, is_occasional")
    .eq("id", customerId)
    .single();
  if (customerError || !customer) return json({ error: "Cliente no encontrado." }, 404);
  if (customer.is_occasional) return json({ error: "Cliente ocasional no es valido para Factura A." }, 400);

  const { data: hasPermission, error: permissionError } = await serviceClient.rpc("has_company_permission", {
    _user_id: user.id,
    _company_id: customer.company_id,
    _permission_code: "customers.edit",
  });
  if (permissionError || !hasPermission) return json({ error: "No tienes permisos para editar clientes." }, 403);

  const { data: settings } = await serviceClient
    .from("billing_settings")
    .select("issuer_tax_id")
    .eq("company_id", customer.company_id)
    .eq("provider", "AFIPSDK")
    .eq("environment", AFIPSDK_ENVIRONMENT)
    .eq("is_enabled", true)
    .limit(1)
    .maybeSingle();
  const issuerTaxId = normalizeCuit(settings?.issuer_tax_id);

  if (!afipSdkAccessToken || !issuerTaxId) {
    const message = !afipSdkAccessToken
      ? "Falta configurar AFIPSDK_ACCESS_TOKEN en Supabase Secrets."
      : "Falta configurar el CUIT emisor AFIPSDK dev para consultar padron.";
    const { data: profile } = await serviceClient
      .from("customer_fiscal_profiles")
      .upsert({
        company_id: customer.company_id,
        customer_id: customer.id,
        tax_id: taxId,
        legal_name: customer.name,
        validation_status: "ERROR",
        validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
        validation_error: message,
        validation_snapshot: null,
        validated_at: null,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "company_id,customer_id" })
      .select("*")
      .single();
    return json({ error: message, profile }, 502);
  }

  const authPayload = buildAfipSdkAuthPayload(issuerTaxId);
  let providerResponse: unknown = null;

  try {
    const tokenAuthorization = await postAfipSdk(afipSdkBaseUrl, "v1/afip/auth", afipSdkAccessToken, authPayload) as {
      token?: string;
      sign?: string;
    };
    if (!tokenAuthorization.token || !tokenAuthorization.sign) {
      throw new Error("Afip SDK no devolvio token/sign para padron.");
    }

    const padronPayload = buildAfipSdkPadronPayload({
      token: tokenAuthorization.token,
      sign: tokenAuthorization.sign,
      issuerTaxId,
      taxId,
    });
    providerResponse = await postAfipSdk(afipSdkBaseUrl, "v1/afip/requests", afipSdkAccessToken, padronPayload);
    const fiscalData = extractFiscalLookupData(taxId, providerResponse);

    const { data: profile, error: upsertError } = await serviceClient
      .from("customer_fiscal_profiles")
      .upsert({
        company_id: customer.company_id,
        customer_id: customer.id,
        tax_id: fiscalData.taxId,
        legal_name: fiscalData.legalName,
        tax_condition: fiscalData.taxCondition,
        fiscal_address: fiscalData.fiscalAddress,
        validation_status: fiscalData.status,
        validation_source: fiscalData.source,
        validation_error: null,
        validation_snapshot: fiscalData.snapshot,
        validated_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "company_id,customer_id" })
      .select("*")
      .single();
    if (upsertError || !profile) throw new Error("No se pudo guardar el perfil fiscal validado.");

    return json({ profile });
  } catch (error) {
    const message = normalizeFiscalLookupError(error);
    const errorWithProvider = error as Error & { providerResponse?: unknown };
    const snapshot = sanitizeProviderPayload(errorWithProvider.providerResponse ?? providerResponse ?? null);
    const { data: profile } = await serviceClient
      .from("customer_fiscal_profiles")
      .upsert({
        company_id: customer.company_id,
        customer_id: customer.id,
        tax_id: taxId,
        legal_name: customer.name,
        validation_status: "ERROR",
        validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
        validation_error: message,
        validation_snapshot: snapshot,
        validated_at: null,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "company_id,customer_id" })
      .select("*")
      .single();

    return json({ error: message, profile }, 502);
  }
});
