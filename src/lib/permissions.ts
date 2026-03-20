export type AppRole = "superadmin" | "admin" | "user";

export function isSuperAdmin(roles: AppRole[]) {
  return roles.includes("superadmin");
}

export function hasAnyRole(roles: AppRole[]) {
  return roles.length > 0;
}

export function hasRole(roles: AppRole[], role: AppRole) {
  return roles.includes(role);
}

export function canManageSettings(roles: AppRole[]) {
  return isSuperAdmin(roles) || hasRole(roles, "admin");
}

export function canViewSettings(roles: AppRole[]) {
  return canManageSettings(roles);
}

export function canManageUsers(roles: AppRole[]) {
  return isSuperAdmin(roles);
}

export function canCreateCashSale(roles: AppRole[]) {
  return hasAnyRole(roles);
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

export function canViewCashHistory(roles: AppRole[]) {
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
