import type { AppRole } from "@/lib/permissions";
import { canManageBillingSettings } from "@/lib/permissions";

type BillingAccessContext = {
  companyRoleCodes?: string[];
  companyPermissionCodes?: string[];
};

export function buildEnableBillingSettingsPayload(companyId: string) {
  return {
    company_id: companyId,
    provider: "AFIPSDK",
    environment: "dev",
    default_currency: "ARS",
    default_concept: "PRODUCTS",
    credentials_status: "NOT_CONFIGURED",
    is_enabled: true,
  } as const;
}

export function buildDisableBillingSettingsPayload() {
  return { is_enabled: false } as const;
}

export function canShowBillingSettingsToggle(roles: AppRole[], context?: BillingAccessContext) {
  return canManageBillingSettings(roles, context);
}
