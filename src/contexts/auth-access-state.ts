import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";
import type { CompanySummary } from "@/contexts/AuthContext";
import type { ImpersonationMeta } from "@/contexts/auth-impersonation";

export type AuthStateSnapshot = {
  companies: CompanySummary[];
  currentCompanyId: string | null;
  effectiveUser: User;
  roles: AppRole[];
};

export type CompanyAccessSnapshot = {
  companyPermissionCodes: string[];
  companyRoleCodes: string[];
};

export async function loadAuthStateSnapshot(params: {
  actorSession: Session | null;
  currentCompanyStorageKey: string;
  impersonationMeta: ImpersonationMeta | null;
}): Promise<AuthStateSnapshot | null> {
  const { actorSession, currentCompanyStorageKey, impersonationMeta } = params;
  const actorUser = actorSession?.user ?? null;
  const userId = impersonationMeta?.targetUserId ?? actorUser?.id ?? null;
  const userEmail = impersonationMeta?.targetEmail ?? actorUser?.email ?? null;

  if (!userId) {
    return null;
  }

  const effectiveUser = {
    ...(actorUser ?? { id: userId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" }),
    id: userId,
    email: userEmail ?? undefined,
  } as User;

  const globalRolesResult = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  let roles: AppRole[];
  if (globalRolesResult.error) {
    roles = ["user"];
  } else {
    const roleSet = new Set<AppRole>((globalRolesResult.data ?? []).map((row) => row.role as AppRole));
    roleSet.add("user");
    roles = Array.from(roleSet);
  }

  const membershipsResult = await supabase
    .from("company_users")
    .select("id,company_id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE");

  const membershipCompanyIds = (membershipsResult.data ?? []).map((row) => row.company_id);
  const shouldLoadAllCompanies = roles.includes("superadmin");

  const companiesQuery = supabase
    .from("companies")
    .select("id,name,slug,status")
    .eq("status", "ACTIVE")
    .order("name");

  const companiesResult = shouldLoadAllCompanies
    ? await companiesQuery
    : membershipCompanyIds.length
      ? await companiesQuery.in("id", membershipCompanyIds)
      : { data: [], error: null };

  if (companiesResult.error) {
    return null;
  }

  const companies = companiesResult.data ?? [];
  const storedCompanyId = localStorage.getItem(currentCompanyStorageKey);
  const currentCompanyId =
    (storedCompanyId && companies.some((company) => company.id === storedCompanyId) ? storedCompanyId : null) ??
    companies[0]?.id ??
    null;

  return {
    companies,
    currentCompanyId,
    effectiveUser,
    roles,
  };
}

export async function loadCompanyAccessSnapshot(params: {
  companyId: string | null;
  userId: string | null;
}): Promise<CompanyAccessSnapshot> {
  const { companyId, userId } = params;
  if (!userId || !companyId) {
    return {
      companyPermissionCodes: [],
      companyRoleCodes: [],
    };
  }

  const { data: companyUser } = await supabase
    .from("company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!companyUser?.id) {
    return {
      companyPermissionCodes: [],
      companyRoleCodes: [],
    };
  }

  const [companyUserRolesResult, companyUserPermissionsResult] = await Promise.all([
    supabase
      .from("company_user_roles")
      .select("role_id")
      .eq("company_user_id", companyUser.id),
    supabase
      .from("company_user_permissions")
      .select("permission_id,effect")
      .eq("company_user_id", companyUser.id),
  ]);

  const roleIds = [...new Set((companyUserRolesResult.data ?? []).map((row) => row.role_id))];

  const [rolesCatalogResult, rolePermissionsResult] = await Promise.all([
    roleIds.length ? supabase.from("roles").select("id,code").in("id", roleIds) : Promise.resolve({ data: [] }),
    roleIds.length
      ? supabase.from("role_permissions").select("role_id, permission_id").in("role_id", roleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const allowedPermissionIds = new Set(
    (companyUserPermissionsResult.data ?? [])
      .filter((row) => row.effect === "ALLOW")
      .map((row) => row.permission_id),
  );
  const deniedPermissionIds = new Set(
    (companyUserPermissionsResult.data ?? [])
      .filter((row) => row.effect === "DENY")
      .map((row) => row.permission_id),
  );
  const inheritedPermissionIds = new Set((rolePermissionsResult.data ?? []).map((row) => row.permission_id));
  const effectivePermissionIds = new Set(
    [...inheritedPermissionIds, ...allowedPermissionIds].filter((permissionId) => !deniedPermissionIds.has(permissionId)),
  );
  const effectivePermissionIdList = [...effectivePermissionIds];
  const permissionsCatalogResult = effectivePermissionIdList.length
    ? await supabase.from("permissions").select("id,code").in("id", effectivePermissionIdList)
    : { data: [] };

  return {
    companyRoleCodes: (rolesCatalogResult.data ?? []).map((row) => row.code),
    companyPermissionCodes: (permissionsCatalogResult.data ?? [])
      .filter((row) => effectivePermissionIds.has(row.id))
      .map((row) => row.code),
  };
}
