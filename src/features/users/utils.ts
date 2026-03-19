import type {
  AccessFormState,
  CompanyRoleOption,
  PermissionOption,
  PermissionOverrideState,
  UserAccessRow,
  UserCompanyAccess,
  UsersFilter,
} from "@/features/users/types";

export function filterUsersAccessList(users: UserAccessRow[], filter: UsersFilter, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  return users.filter((user) => {
    const matchesFilter =
      filter === "ALL" ||
      (filter === "SUPERADMINS" && user.global_roles?.includes("superadmin")) ||
      (filter === "WITHOUT_COMPANY" && (user.companies?.length ?? 0) === 0) ||
      (filter === "INACTIVE_MEMBERSHIPS" && (user.companies ?? []).some((company) => company.status === "INACTIVE"));

    if (!matchesFilter) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      user.full_name ?? "",
      user.email ?? "",
      ...(user.global_roles ?? []),
      ...(user.companies ?? []).flatMap((company) => [company.companyName, company.companySlug, ...(company.roles ?? [])]),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

export function groupPermissionsByModule(permissionOptions: PermissionOption[]) {
  return permissionOptions.reduce<Record<string, PermissionOption[]>>((groups, permission) => {
    const moduleKey = permission.module;
    if (!groups[moduleKey]) groups[moduleKey] = [];
    groups[moduleKey].push(permission);
    return groups;
  }, {});
}

export function buildPermissionOverrideStats(permissionOverrides: PermissionOverrideState) {
  const values = Object.values(permissionOverrides);

  return {
    allow: values.filter((value) => value === "ALLOW").length,
    deny: values.filter((value) => value === "DENY").length,
  };
}

export function buildPermissionOverridesState(
  permissionOptions: PermissionOption[],
  existingPermissionOverrides: Array<{ permission_id: string; effect: "ALLOW" | "DENY" | "INHERIT" }>,
) {
  const nextOverrides: PermissionOverrideState = {};

  for (const permission of permissionOptions) {
    nextOverrides[permission.id] = "INHERIT";
  }

  for (const row of existingPermissionOverrides) {
    nextOverrides[row.permission_id] = row.effect;
  }

  return nextOverrides;
}

export function buildAccessFormState(
  companyRoleOptions: CompanyRoleOption[],
  company?: UserCompanyAccess,
): AccessFormState {
  const matchingRole = company?.roles?.[0]
    ? companyRoleOptions.find((role) => role.code === company.roles[0])
    : companyRoleOptions[0];

  return {
    companyUserId: company?.companyUserId ?? null,
    companyId: company?.companyId ?? "",
    roleId: matchingRole?.id ?? "",
    status: (company?.status as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE",
  };
}
