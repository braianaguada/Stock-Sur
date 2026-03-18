export type AppRole = "admin" | "user";

export function hasAnyRole(roles: AppRole[]) {
  return roles.length > 0;
}

export function hasRole(roles: AppRole[], role: AppRole) {
  return roles.includes(role);
}

export function canManageSettings(roles: AppRole[]) {
  return hasRole(roles, "admin");
}

export function canViewSettings(roles: AppRole[]) {
  return canManageSettings(roles);
}

export function canCreateCashSale(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canAttachCashReceipt(roles: AppRole[]) {
  return hasAnyRole(roles);
}

export function canCloseCash(roles: AppRole[]) {
  return hasRole(roles, "admin");
}

export function canCancelCashSale(roles: AppRole[]) {
  return hasRole(roles, "admin");
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
  if (hasRole(roles, "admin")) return true;
  if (status === "ENVIADO") return hasAnyRole(roles);
  return false;
}
