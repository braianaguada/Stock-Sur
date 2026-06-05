#!/usr/bin/env node

const [, , taxIdArg, customerIdArg] = process.argv;

if (!taxIdArg || !customerIdArg) {
  console.error("Uso: node scripts/customer-fiscal-lookup-qa.mjs <CUIT> <CUSTOMER_ID>");
  console.error("Requiere SUPABASE_FUNCTIONS_URL o VITE_SUPABASE_URL y SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_FUNCTIONS_URL ?? process.env.VITE_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !accessToken) {
  console.error("Faltan SUPABASE_FUNCTIONS_URL/VITE_SUPABASE_URL o SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const functionsUrl = supabaseUrl.includes("/functions/v1")
  ? supabaseUrl.replace(/\/$/, "")
  : `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;

const response = await fetch(`${functionsUrl}/customer-fiscal-lookup`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    customerId: customerIdArg,
    taxId: taxIdArg,
  }),
});

const payload = await response.json().catch(() => ({}));
const diagnostics = payload.diagnostics ?? {};
const profile = payload.profile ?? {};

const report = {
  httpStatus: response.status,
  ok: Boolean(payload.ok),
  code: payload.code ?? diagnostics.code ?? null,
  message: payload.error ?? diagnostics.message ?? null,
  lookupEnvironment: diagnostics.lookupEnvironment ?? null,
  taxpayerFound: diagnostics.taxpayerFound ?? null,
  hasDatosGenerales: diagnostics.hasDatosGenerales ?? null,
  hasRegimenGeneral: diagnostics.hasRegimenGeneral ?? null,
  hasImpuestos: diagnostics.hasImpuestos ?? null,
  hasMonotributo: diagnostics.hasMonotributo ?? null,
  taxpayerStatus: diagnostics.taxpayerStatus ?? profile.taxpayer_status ?? null,
  taxCondition: diagnostics.taxCondition ?? profile.tax_condition ?? null,
  eligibleForInvoiceA: Boolean(
    payload.ok &&
    profile.validation_status === "VALIDATED_AUTO" &&
    profile.legal_name_source === "OFFICIAL" &&
    profile.tax_condition_source === "OFFICIAL_DERIVED" &&
    profile.tax_condition === "RESPONSABLE_INSCRIPTO" &&
    profile.taxpayer_status === "ACTIVO" &&
    profile.legal_name,
  ),
  normalizationReason: diagnostics.normalizationReason ?? null,
};

console.log(JSON.stringify(report, null, 2));
