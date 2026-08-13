export type AppRole = "superadmin" | "admin" | "user";

type CompanyAccessContext = {
  companyRoleCodes?: string[];
  companyPermissionCodes?: string[];
};

function isSuperAdmin(roles: AppRole[]) {
  return roles.includes("superadmin");
}

function hasAnyRole(roles: AppRole[]) {
  return roles.length > 0;
}

function hasRole(roles: AppRole[], role: AppRole) {
  return roles.includes(role);
}

export function canManageSettings(roles: AppRole[]) {
  return isSuperAdmin(roles) || hasRole(roles, "admin");
}

export function canManageCompanySettings(roles: AppRole[], context?: CompanyAccessContext) {
  if (canManageSettings(roles)) return true;

  const companyRoleCodes = context?.companyRoleCodes ?? [];
  const companyPermissionCodes = context?.companyPermissionCodes ?? [];

  return companyRoleCodes.includes("admin") || companyPermissionCodes.includes("settings.manage");
}

export function canViewSettings(roles: AppRole[], context?: CompanyAccessContext) {
  if (canManageCompanySettings(roles, context)) return true;

  const companyPermissionCodes = context?.companyPermissionCodes ?? [];
  return companyPermissionCodes.includes("settings.view");
}

function hasCompanyPermission(
  roles: AppRole[],
  context: CompanyAccessContext | undefined,
  permissionCode: string,
) {
  if (isSuperAdmin(roles) || hasRole(roles, "admin")) return true;

  const companyRoleCodes = context?.companyRoleCodes ?? [];
  const companyPermissionCodes = context?.companyPermissionCodes ?? [];

  return companyRoleCodes.includes("admin") || companyPermissionCodes.includes(permissionCode);
}

function hasEffectiveCompanyPermission(context: CompanyAccessContext | undefined, permissionCode: string) {
  const companyPermissionCodes = context?.companyPermissionCodes ?? [];

  return companyPermissionCodes.includes(permissionCode);
}

export function canManageUsers(roles: AppRole[]) {
  return isSuperAdmin(roles);
}

export function canCreateCashSale(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "cash.create");
}

export function canAttachCashReceipt(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCloseCash(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCancelCashSale(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCreateCashExpense(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCancelCashExpense(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCreateDocumentDraft(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canEditDocumentDraft(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canIssueRemito(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCloneBudgetToRemito(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canPrintDocument(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canTransitionDocumentTo(roles: AppRole[], status: "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO") {
  if (isSuperAdmin(roles) || hasRole(roles, "admin")) return true;
  if (!hasAnyRole(roles)) return false;
  return ["ENVIADO", "APROBADO", "RECHAZADO", "ANULADO"].includes(status);
}

export function canViewBilling(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "billing.view");
}

export function canCreateBilling(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "billing.create");
}

export function canAuthorizeBilling(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "billing.authorize");
}

export function canCreateBillingCreditNote(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "billing.credit_note");
}

export function canPrintBilling(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "billing.print");
}

export function canManageBillingSettings(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "billing.settings");
}

export function canViewStock(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "stock.view");
}

export function canEditStock(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "stock.edit");
}

export function canViewSettlements(roles: AppRole[], context?: CompanyAccessContext) {
  return hasCompanyPermission(roles, context, "settlements.view");
}

export function canCreateSettlements(_roles: AppRole[], context?: CompanyAccessContext) {
  return hasEffectiveCompanyPermission(context, "settlements.create");
}

export function canEditSettlements(_roles: AppRole[], context?: CompanyAccessContext) {
  return hasEffectiveCompanyPermission(context, "settlements.edit");
}

export function canSubmitSettlements(_roles: AppRole[], context?: CompanyAccessContext) {
  return hasEffectiveCompanyPermission(context, "settlements.submit");
}

export function canReceiveSettlements(_roles: AppRole[], context?: CompanyAccessContext) {
  return hasEffectiveCompanyPermission(context, "settlements.receive");
}

export function canCancelSettlements(_roles: AppRole[], context?: CompanyAccessContext) {
  return hasEffectiveCompanyPermission(context, "settlements.cancel");
}
