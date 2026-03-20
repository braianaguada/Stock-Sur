import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CompanyOption,
  CompanyRoleOption,
  PermissionOption,
  UserAccessRow,
} from "@/features/users/types";

export async function listUsersWithAccess() {
  const { data, error } = await supabase.rpc("list_users_with_access");
  if (error) throw error;
  return ((data ?? []) as unknown) as UserAccessRow[];
}

export async function listActiveCompanies() {
  const { data, error } = await supabase.from("companies").select("id,name,slug").eq("status", "ACTIVE").order("name");
  if (error) throw error;
  return (data ?? []) as CompanyOption[];
}

export async function listCompanyRoles() {
  const { data, error } = await supabase
    .from("roles")
    .select("id,code,name")
    .eq("scope", "COMPANY")
    .in("code", ["admin", "operador", "consulta"])
    .order("name");
  if (error) throw error;
  return (data ?? []) as CompanyRoleOption[];
}

export async function listPermissionOptions() {
  const { data, error } = await supabase
    .from("permissions")
    .select("id,code,module,action,description")
    .neq("module", "users")
    .order("module")
    .order("action");
  if (error) throw error;
  return (data ?? []) as PermissionOption[];
}

export async function listRolePermissionIds(roleId: string) {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);
  if (error) throw error;
  return (data ?? []).map((row) => row.permission_id);
}

export async function listCompanyPermissionOverrides(companyUserId: string) {
  const { data, error } = await supabase
    .from("company_user_permissions")
    .select("permission_id,effect")
    .eq("company_user_id", companyUserId);
  if (error) throw error;
  return data ?? [];
}

export async function syncSelectedUserAccess(queryClient: QueryClient, userId: string) {
  const users = await listUsersWithAccess();
  queryClient.setQueryData(["users-access-list"], users);
  return users.find((user) => user.user_id === userId) ?? null;
}
