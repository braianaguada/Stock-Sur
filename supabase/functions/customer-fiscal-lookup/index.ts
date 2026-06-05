import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AFIPSDK_BASE_URL,
  AFIPSDK_PADRON_WSID,
  buildFiscalLookupDiagnostics,
  buildAfipSdkAuthPayload,
  buildAfipSdkPadronPayload,
  extractFiscalLookupData,
  getCuitValidationMessage,
  normalizeAfipSdkBaseUrl,
  normalizeAfipSdkEnvironment,
  normalizeCuit,
  normalizeFiscalLookupError,
  sanitizeProviderPayload,
  type FiscalLookupErrorCode,
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

function maskTaxId(value: string) {
  const digits = normalizeCuit(value);
  if (digits.length < 4) return "[missing]";
  return `${digits.slice(0, 2)}******${digits.slice(-3)}`;
}

function sanitizeProfileForClient<T extends Record<string, unknown> | null>(profile: T) {
  if (!profile) return profile;
  return {
    ...profile,
    validation_snapshot: null,
  };
}

function classifyProviderError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const status = Number((error as Error & { status?: number | null })?.status);
  if (/no existe persona|not found|no encontrado|no encontrada/i.test(raw) || status === 404) return "TAXPAYER_NOT_FOUND" as const;
  if (/service|servicio|habilitad|forbidden|unauthorized|401|403/i.test(raw) || [401, 403].includes(status)) {
    return "SERVICE_NOT_ENABLED" as const;
  }
  return "AFIPSDK_ERROR" as const;
}

function logLookup(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({
    event,
    function: "customer-fiscal-lookup",
    ...details,
  }));
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
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const afipSdkAccessToken = Deno.env.get("AFIPSDK_ACCESS_TOKEN");
  const afipSdkBaseUrl = normalizeAfipSdkBaseUrl(Deno.env.get("AFIPSDK_BASE_URL") ?? AFIPSDK_BASE_URL);
  const afipSdkEnvironment = normalizeAfipSdkEnvironment(
    Deno.env.get("CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT") ?? Deno.env.get("AFIPSDK_ENVIRONMENT"),
  );

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
  if (taxIdError) {
    return json({
      ok: false,
      error: taxIdError,
      diagnostics: buildFiscalLookupDiagnostics({
        response: null,
        lookupEnvironment: afipSdkEnvironment,
        code: "INVALID_TAX_ID",
        message: taxIdError,
        taxCondition: "UNKNOWN",
      }),
    }, 400);
  }

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
    .eq("environment", afipSdkEnvironment)
    .eq("is_enabled", true)
    .limit(1)
    .maybeSingle();
  const issuerTaxId = normalizeCuit(settings?.issuer_tax_id);
  if (!afipSdkAccessToken || !issuerTaxId) {
    const message = !afipSdkAccessToken
      ? "Falta configurar AFIPSDK_ACCESS_TOKEN en Supabase Secrets."
      : `Falta configurar el CUIT emisor AFIPSDK ${afipSdkEnvironment} para consultar padron.`;
    const diagnostics = buildFiscalLookupDiagnostics({
      response: null,
      lookupEnvironment: afipSdkEnvironment,
      code: "SERVICE_NOT_ENABLED",
      message,
      taxCondition: "UNKNOWN",
    });
    const { data: profile } = await serviceClient
      .from("customer_fiscal_profiles")
      .upsert({
        company_id: customer.company_id,
        customer_id: customer.id,
        tax_id: taxId,
        legal_name: "",
        tax_condition: "UNKNOWN",
        fiscal_address: null,
        taxpayer_status: null,
        validation_status: "ERROR",
        validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
        tax_condition_source: "UNKNOWN",
        legal_name_source: "UNKNOWN",
        validation_error: message,
        validation_snapshot: diagnostics,
        validated_at: null,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "company_id,customer_id" })
      .select("*")
      .single();
    logLookup("customer_fiscal_lookup_result", {
      requestId,
      userId: user.id,
      companyId: customer.company_id,
      customerId: customer.id,
      taxId,
      lookupEnvironment: afipSdkEnvironment,
      issuerTaxId: maskTaxId(issuerTaxId),
      wsid: AFIPSDK_PADRON_WSID,
      method: "getPersona_v2",
      responseShape: diagnostics,
      normalizationResult: diagnostics.taxCondition,
      errorCode: diagnostics.code,
    });
    return json({ ok: false, error: message, code: diagnostics.code, diagnostics, profile: sanitizeProfileForClient(profile) });
  }

  const authPayload = buildAfipSdkAuthPayload(issuerTaxId, afipSdkEnvironment);
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
      environment: afipSdkEnvironment,
    });
    providerResponse = await postAfipSdk(afipSdkBaseUrl, "v1/afip/requests", afipSdkAccessToken, padronPayload);
    const fiscalData = extractFiscalLookupData(taxId, providerResponse, afipSdkEnvironment);

    const { data: profile, error: upsertError } = await serviceClient
      .from("customer_fiscal_profiles")
      .upsert({
        company_id: customer.company_id,
        customer_id: customer.id,
        tax_id: fiscalData.taxId,
        legal_name: fiscalData.legalName,
        tax_condition: fiscalData.taxCondition,
        fiscal_address: fiscalData.fiscalAddress,
        taxpayer_status: fiscalData.taxpayerStatus,
        validation_status: fiscalData.status,
        validation_source: fiscalData.source,
        tax_condition_source: fiscalData.taxConditionSource,
        legal_name_source: fiscalData.legalNameSource,
        validation_error: null,
        validation_snapshot: fiscalData.snapshot,
        validated_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "company_id,customer_id" })
      .select("*")
      .single();
    if (upsertError || !profile) throw new Error("No se pudo guardar el perfil fiscal validado.");

    logLookup("customer_fiscal_lookup_result", {
      requestId,
      userId: user.id,
      companyId: customer.company_id,
      customerId: customer.id,
      taxId,
      lookupEnvironment: afipSdkEnvironment,
      issuerTaxId: maskTaxId(issuerTaxId),
      wsid: AFIPSDK_PADRON_WSID,
      method: "getPersona_v2",
      responseShape: fiscalData.diagnostics,
      normalizationResult: fiscalData.taxCondition,
      errorCode: null,
    });

    return json({ ok: true, diagnostics: fiscalData.diagnostics, profile: sanitizeProfileForClient(profile) });
  } catch (error) {
    const message = normalizeFiscalLookupError(error);
    const errorWithProvider = error as Error & {
      providerResponse?: unknown;
      fiscalCode?: FiscalLookupErrorCode;
      diagnostics?: ReturnType<typeof buildFiscalLookupDiagnostics>;
    };
    const code = errorWithProvider.fiscalCode ?? classifyProviderError(error);
    const snapshot = sanitizeProviderPayload(errorWithProvider.providerResponse ?? providerResponse ?? null);
    const diagnostics = errorWithProvider.diagnostics ?? buildFiscalLookupDiagnostics({
      response: errorWithProvider.providerResponse ?? providerResponse ?? null,
      lookupEnvironment: afipSdkEnvironment,
      code,
      message,
      taxCondition: "UNKNOWN",
    });
    const { data: profile } = await serviceClient
      .from("customer_fiscal_profiles")
      .upsert({
        company_id: customer.company_id,
        customer_id: customer.id,
        tax_id: taxId,
        legal_name: "",
        tax_condition: "UNKNOWN",
        fiscal_address: null,
        taxpayer_status: diagnostics.taxpayerStatus,
        validation_status: "ERROR",
        validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
        tax_condition_source: "UNKNOWN",
        legal_name_source: "UNKNOWN",
        validation_error: message,
        validation_snapshot: {
          diagnostics,
          providerSnapshot: snapshot,
        },
        validated_at: null,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "company_id,customer_id" })
      .select("*")
      .single();

    logLookup("customer_fiscal_lookup_result", {
      requestId,
      userId: user.id,
      companyId: customer.company_id,
      customerId: customer.id,
      taxId,
      lookupEnvironment: afipSdkEnvironment,
      issuerTaxId: maskTaxId(issuerTaxId),
      wsid: AFIPSDK_PADRON_WSID,
      method: "getPersona_v2",
      responseShape: diagnostics,
      normalizationResult: diagnostics.taxCondition,
      errorCode: diagnostics.code,
    });

    return json({ ok: false, error: message, code: diagnostics.code, diagnostics, profile: sanitizeProfileForClient(profile) });
  }
});
