import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AFIPSDK_BASE_URL,
  AFIPSDK_ENVIRONMENT,
  buildAfipSdkAuthPayload,
  buildAfipSdkInvoicePayload,
  buildAfipSdkLastVoucherPayload,
  normalizeAfipSdkBaseUrl,
  parseAfipSdkAuthorizationResponse,
  parseLastVoucherNumber,
  resolveAuthorizationPointOfSale,
  sanitizeProviderPayload,
  normalizeBillingError,
  assertAuthorizationPreconditions,
  assertCreditNoteRelatedInvoicePreconditions,
  getAuthorizationLockFailureMessage,
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const afipSdkAccessToken = Deno.env.get("AFIPSDK_ACCESS_TOKEN");
  const afipSdkBaseUrl = normalizeAfipSdkBaseUrl(Deno.env.get("AFIPSDK_BASE_URL") ?? AFIPSDK_BASE_URL);

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

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const billingDocumentId = typeof body.billingDocumentId === "string" ? body.billingDocumentId : "";

  if (!billingDocumentId) {
    return json({ error: "Debes indicar el comprobante fiscal a autorizar." }, 400);
  }

  const { data: document, error: documentError } = await serviceClient
    .from("billing_documents")
    .select("*")
    .eq("id", billingDocumentId)
    .single();

  if (documentError || !document) {
    return json({ error: "Comprobante fiscal no encontrado." }, 404);
  }

  const { data: hasAuthorizePermission, error: permissionError } = await serviceClient.rpc("has_company_permission", {
    _user_id: user.id,
    _company_id: document.company_id,
    _permission_code: "billing.authorize",
  });

  const { data: hasCreditNotePermission, error: creditNotePermissionError } = await serviceClient.rpc("has_company_permission", {
    _user_id: user.id,
    _company_id: document.company_id,
    _permission_code: "billing.credit_note",
  });

  if (permissionError || creditNotePermissionError || (!hasAuthorizePermission && !hasCreditNotePermission)) {
    return json({ error: "No tienes permisos para autorizar comprobantes fiscales." }, 403);
  }

  const { data: settings, error: settingsError } = await serviceClient
    .from("billing_settings")
    .select("*")
    .eq("company_id", document.company_id)
    .eq("provider", "AFIPSDK")
    .eq("environment", AFIPSDK_ENVIRONMENT)
    .limit(1)
    .single();

  if (settingsError || !settings) {
    return json({ error: "No se encontro configuracion AFIPSDK dev para esta empresa." }, 400);
  }

  const effectiveSettings = {
    ...settings,
    issuer_tax_id: document.issuer_tax_id ?? settings.issuer_tax_id,
  };

  const { data: pointsOfSale, error: pointsOfSaleError } = await serviceClient
    .from("billing_points_of_sale")
    .select("point_of_sale, is_enabled")
    .eq("company_id", document.company_id)
    .eq("billing_settings_id", settings.id)
    .eq("is_enabled", true)
    .order("point_of_sale", { ascending: true });

  if (pointsOfSaleError) {
    return json({ error: "No se pudieron leer los puntos de venta fiscales." }, 500);
  }

  let resolvedPointOfSale = 0;
  try {
    resolvedPointOfSale = resolveAuthorizationPointOfSale({
      document,
      pointsOfSale: pointsOfSale ?? [],
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "El comprobante no tiene punto de venta fiscal configurado." }, 400);
  }

  const effectiveDocument = {
    ...document,
    point_of_sale: resolvedPointOfSale,
  };

  const { data: lines, error: linesError } = await serviceClient
    .from("billing_document_lines")
    .select("*")
    .eq("billing_document_id", document.id)
    .order("line_order", { ascending: true });

  if (linesError) {
    return json({ error: "No se pudieron leer las lineas del comprobante." }, 500);
  }

  let relatedInvoice: Record<string, unknown> | null = null;
  if (effectiveDocument.document_kind === "CREDIT_NOTE") {
    const relatedId = typeof effectiveDocument.related_billing_document_id === "string"
      ? effectiveDocument.related_billing_document_id
      : "";
    if (!relatedId) {
      return json({ error: "La Nota de Credito B debe estar vinculada a una Factura B autorizada." }, 400);
    }

    const { data: relatedDocument, error: relatedError } = await serviceClient
      .from("billing_documents")
      .select("id, company_id, document_kind, invoice_type, fiscal_status, point_of_sale, voucher_number, voucher_date, cae")
      .eq("id", relatedId)
      .maybeSingle();

    if (relatedError) {
      return json({ error: "No se pudo leer la Factura B asociada." }, 500);
    }
    relatedInvoice = relatedDocument ?? null;

    const { count: existingCreditNotes, error: duplicateError } = await serviceClient
      .from("billing_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", effectiveDocument.company_id)
      .eq("related_billing_document_id", relatedId)
      .eq("document_kind", "CREDIT_NOTE")
      .eq("invoice_type", "NOTA_CREDITO_B")
      .neq("fiscal_status", "CANCELLED_INTERNAL")
      .neq("id", effectiveDocument.id);

    if (duplicateError) {
      return json({ error: "No se pudo validar si ya existe una Nota de Credito B para esta factura." }, 500);
    }
    if ((existingCreditNotes ?? 0) > 0) {
      return json({ error: "Ya existe una Nota de Credito B activa para esta factura." }, 409);
    }
  }

  try {
    assertAuthorizationPreconditions({ document: effectiveDocument, settings: effectiveSettings, lines: lines ?? [] });
    assertCreditNoteRelatedInvoicePreconditions({ document: effectiveDocument, relatedInvoice: relatedInvoice as never });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "El comprobante no es autorizable." }, 400);
  }

  if (!afipSdkAccessToken) {
    await serviceClient
      .from("billing_settings")
      .update({ credentials_status: "NOT_CONFIGURED" })
      .eq("id", settings.id);

    return json({ error: "Falta configurar las credenciales de Afip SDK en Supabase Secrets." }, 500);
  }

  const { data: lockedDocument, error: lockError } = await serviceClient
    .from("billing_documents")
    .update({
      fiscal_status: "AUTHORIZING",
      error_message: null,
      provider_errors: [],
      provider_observations: [],
      point_of_sale: resolvedPointOfSale,
    })
    .eq("id", document.id)
    .in("fiscal_status", ["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"])
    .select("*")
    .single();

  if (lockError || !lockedDocument) {
    const { data: currentDocument } = await serviceClient
      .from("billing_documents")
      .select("id, fiscal_status, cae, voucher_number, updated_at")
      .eq("id", document.id)
      .maybeSingle();
    const message = getAuthorizationLockFailureMessage({
      document: currentDocument,
      lockError: lockError
        ? { code: (lockError as { code?: string }).code, message: lockError.message }
        : null,
    });

    console.error("billing_authorize_lock_failed", JSON.stringify({
      billingDocumentId: document.id,
      fiscalStatusRead: document.fiscal_status,
      currentFiscalStatus: currentDocument?.fiscal_status ?? null,
      invoiceType: document.invoice_type,
      documentKind: document.document_kind,
      cae: Boolean(document.cae ?? currentDocument?.cae),
      voucherNumber: document.voucher_number ?? currentDocument?.voucher_number ?? null,
      sourceType: document.source_type,
      sourceId: document.source_id,
      sourceRemitoId: document.source_remito_id,
      attemptedStatus: "AUTHORIZING",
      lockErrorCode: lockError ? (lockError as { code?: string }).code ?? null : null,
      lockErrorMessage: lockError?.message ?? null,
    }));

    return json({ error: message }, lockError ? 500 : 409);
  }

  const authPayload = buildAfipSdkAuthPayload(effectiveSettings);
  let requestPayload: unknown = null;
  let providerResponse: unknown = null;

  try {
    const tokenAuthorization = await postAfipSdk(afipSdkBaseUrl, "v1/afip/auth", afipSdkAccessToken, authPayload) as {
      token?: string;
      sign?: string;
    };

    if (!tokenAuthorization.token || !tokenAuthorization.sign) {
      throw new Error("Afip SDK no devolvio token/sign para wsfe.");
    }

    const lastVoucherPayload = buildAfipSdkLastVoucherPayload({
      settings: effectiveSettings,
      tokenAuthorization: {
        token: tokenAuthorization.token,
        sign: tokenAuthorization.sign,
      },
      pointOfSale: Number(lockedDocument.point_of_sale),
      invoiceType: lockedDocument.invoice_type,
    });
    const lastVoucherResponse = await postAfipSdk(afipSdkBaseUrl, "v1/afip/requests", afipSdkAccessToken, lastVoucherPayload);
    const nextVoucherNumber = parseLastVoucherNumber(lastVoucherResponse) + 1;

    requestPayload = buildAfipSdkInvoicePayload({
      document: lockedDocument,
      settings: effectiveSettings,
      lines: lines ?? [],
      tokenAuthorization: {
        token: tokenAuthorization.token,
        sign: tokenAuthorization.sign,
      },
      voucherNumber: nextVoucherNumber,
      relatedInvoice: relatedInvoice as never,
    });

    providerResponse = await postAfipSdk(afipSdkBaseUrl, "v1/afip/requests", afipSdkAccessToken, requestPayload);
    const authorization = parseAfipSdkAuthorizationResponse({
      response: providerResponse,
      pointOfSale: Number(lockedDocument.point_of_sale),
      fallbackVoucherNumber: nextVoucherNumber,
    });

    const { data: authorizedDocument, error: updateError } = await serviceClient
      .from("billing_documents")
      .update({
        fiscal_status: "AUTHORIZED",
        voucher_number: authorization.voucherNumber,
        voucher_full_number: authorization.voucherFullNumber,
        voucher_date: authorization.voucherDate,
        cae: authorization.cae,
        cae_expires_at: authorization.caeExpiresAt,
        authorized_at: new Date().toISOString(),
        authorized_by: user.id,
        provider_request: {
          auth: sanitizeProviderPayload(authPayload),
          lastVoucher: sanitizeProviderPayload(lastVoucherPayload),
          invoice: sanitizeProviderPayload(requestPayload),
        },
        provider_response: sanitizeProviderPayload(providerResponse),
        provider_errors: authorization.errors,
        provider_observations: authorization.observations,
        error_message: null,
      })
      .eq("id", lockedDocument.id)
      .select("*")
      .single();

    if (updateError || !authorizedDocument) {
      throw new Error("Afip SDK autorizo el comprobante, pero no se pudo guardar el CAE.");
    }

    const { error: authorizedEventError } = await serviceClient.from("billing_events").insert({
      company_id: lockedDocument.company_id,
      billing_document_id: lockedDocument.id,
      event_type: "AUTHORIZED",
      payload: {
        from_status: lockedDocument.fiscal_status,
        to_status: "AUTHORIZED",
        voucher_number: authorization.voucherNumber,
        voucher_full_number: authorization.voucherFullNumber,
        cae: authorization.cae,
        cae_expires_at: authorization.caeExpiresAt,
        provider_observations: authorization.observations,
      },
      created_by: user.id,
    });
    if (authorizedEventError) {
      console.error("billing_authorized_event_insert_failed", JSON.stringify({
        billingDocumentId: lockedDocument.id,
        errorCode: authorizedEventError.code,
        errorMessage: authorizedEventError.message,
      }));
    }

    await serviceClient
      .from("billing_settings")
      .update({ credentials_status: "CONFIGURED" })
      .eq("id", settings.id);

    return json({ document: authorizedDocument });
  } catch (error) {
    const message = normalizeBillingError(error);
    const errorWithProvider = error as Error & { providerResponse?: unknown };
    const sanitizedResponse = sanitizeProviderPayload(errorWithProvider.providerResponse ?? providerResponse ?? null);

    await serviceClient
      .from("billing_documents")
      .update({
        fiscal_status: "REJECTED",
        provider_request: sanitizeProviderPayload(requestPayload ?? authPayload),
        provider_response: sanitizedResponse,
        provider_errors: [{ message }],
        error_message: message,
      })
      .eq("id", lockedDocument.id);

    const { error: rejectedEventError } = await serviceClient.from("billing_events").insert({
      company_id: lockedDocument.company_id,
      billing_document_id: lockedDocument.id,
      event_type: "REJECTED",
      payload: {
        from_status: lockedDocument.fiscal_status,
        to_status: "REJECTED",
        error_message: message,
        provider_response: sanitizedResponse,
      },
      created_by: user.id,
    });
    if (rejectedEventError) {
      console.error("billing_rejected_event_insert_failed", JSON.stringify({
        billingDocumentId: lockedDocument.id,
        errorCode: rejectedEventError.code,
        errorMessage: rejectedEventError.message,
      }));
    }

    await serviceClient
      .from("billing_settings")
      .update({ credentials_status: "ERROR" })
      .eq("id", settings.id);

    return json({ error: message }, 502);
  }
});
