export type AppRole = "admin" | "user";

export function hasRole(roles: AppRole[], role: AppRole) {
  return roles.includes(role);
}

export function canManageSettings(roles: AppRole[]) {
  return hasRole(roles, "admin");
}

export function canViewSettings(roles: AppRole[]) {
  return canManageSettings(roles);
}
