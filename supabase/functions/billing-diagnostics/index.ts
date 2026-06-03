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

function getBearerToken(authHeader: string | null) {
  const value = authHeader ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Faltan secretos requeridos de Supabase." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!getBearerToken(authHeader)) {
    return json({ error: "Falta el header Authorization." }, 401);
  }

  const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });

  const {
    data: { user },
    error: userError,
  } = await actorClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "No se pudo validar la sesion actual." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  if (!companyId) {
    return json({ error: "Debes indicar la empresa para diagnosticar facturacion." }, 400);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: hasSettingsPermission, error: permissionError } = await serviceClient.rpc("has_company_permission", {
    _user_id: user.id,
    _company_id: companyId,
    _permission_code: "billing.settings",
  });

  if (permissionError || !hasSettingsPermission) {
    return json({ error: "No tienes permisos para diagnosticar la configuracion fiscal." }, 403);
  }

  const { data: settings, error: settingsError } = await serviceClient
    .from("billing_settings")
    .select("id, is_enabled, provider, environment, issuer_tax_id, credentials_status")
    .eq("company_id", companyId)
    .eq("provider", "AFIPSDK")
    .eq("environment", "dev")
    .maybeSingle();

  if (settingsError) {
    return json({ error: "No se pudo leer la configuracion fiscal." }, 500);
  }

  const { count: enabledPosCount, error: posError } = await serviceClient
    .from("billing_points_of_sale")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("billing_settings_id", settings?.id ?? "00000000-0000-0000-0000-000000000000")
    .eq("is_enabled", true);

  if (posError) {
    return json({ error: "No se pudieron leer los puntos de venta fiscales." }, 500);
  }

  const { data: lastAuthorized } = await serviceClient
    .from("billing_documents")
    .select("authorized_at")
    .eq("company_id", companyId)
    .eq("provider", "AFIPSDK")
    .eq("environment", "dev")
    .eq("fiscal_status", "AUTHORIZED")
    .order("authorized_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { data: lastRejected } = await serviceClient
    .from("billing_documents")
    .select("updated_at, error_message")
    .eq("company_id", companyId)
    .eq("provider", "AFIPSDK")
    .eq("environment", "dev")
    .eq("fiscal_status", "REJECTED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const issuerTaxId = onlyDigits(settings?.issuer_tax_id);

  return json({
    billingEnabled: Boolean(settings?.is_enabled),
    provider: settings?.provider ?? "AFIPSDK",
    environment: settings?.environment ?? "dev",
    issuerTaxIdConfigured: issuerTaxId.length > 0,
    issuerTaxIdValid: issuerTaxId.length === 11,
    posConfigured: (enabledPosCount ?? 0) > 0,
    afipSdkAccessTokenConfigured: Boolean(Deno.env.get("AFIPSDK_ACCESS_TOKEN")),
    afipSdkBaseUrlConfigured: Boolean(Deno.env.get("AFIPSDK_BASE_URL")),
    afipSdkEnvironmentConfigured: Deno.env.get("AFIPSDK_ENVIRONMENT") === "dev",
    edgeFunctionAvailable: true,
    lastAuthorizedAt: lastAuthorized?.authorized_at ?? null,
    lastErrorAt: lastRejected?.updated_at ?? null,
    lastErrorMessage: lastRejected?.error_message ?? null,
  });
});
