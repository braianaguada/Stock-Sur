import { supabase } from "@/integrations/supabase/client";
import type {
  AccessFormState,
  PermissionOverrideState,
  UserAccessRow,
} from "@/features/users/types";
import { buildPermissionOverridePayload } from "@/features/users/utils";

export async function createCompany(params: { name: string; slug: string }) {
  const { data, error } = await supabase.rpc("create_company", {
    p_name: params.name,
    p_slug: params.slug,
  });
  if (error) throw error;
  return data;
}

export async function saveUserCompanyAccess(params: {
  selectedUser: UserAccessRow | null;
  accessForm: AccessFormState;
  permissionOverrides: PermissionOverrideState;
  hasSelectedUser: boolean;
  hasCompany: boolean;
  hasRole: boolean;
}) {
  const { selectedUser, accessForm, permissionOverrides, hasSelectedUser, hasCompany, hasRole } = params;

  if (!selectedUser) throw new Error("Seleccioná un usuario");
  if (!accessForm.companyId) throw new Error("Seleccioná una empresa");
  if (!accessForm.roleId) throw new Error("Seleccioná un rol");
  if (!hasSelectedUser) throw new Error("El usuario seleccionado ya no está disponible. Recargá Usuarios e intentá de nuevo");
  if (!hasCompany) throw new Error("La empresa seleccionada ya no está disponible. Recargá Usuarios e intentá de nuevo");
  if (!hasRole) throw new Error("El rol seleccionado ya no está disponible. Recargá Usuarios e intentá de nuevo");

  const { data, error } = await supabase.rpc("save_user_company_access", {
    p_user_id: selectedUser.user_id,
    p_company_id: accessForm.companyId,
    p_status: accessForm.status,
    p_role_id: accessForm.roleId,
    p_permission_overrides: buildPermissionOverridePayload(permissionOverrides),
  });
  if (error) throw error;
  return data;
}
