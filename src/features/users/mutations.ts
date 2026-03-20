import { supabase } from "@/integrations/supabase/client";
import type {
  AccessFormState,
  PermissionOverrideState,
  UserAccessRow,
} from "@/features/users/types";

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

  let companyUserId = accessForm.companyUserId;

  if (companyUserId) {
    const { error } = await supabase
      .from("company_users")
      .update({ status: accessForm.status })
      .eq("id", companyUserId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("company_users")
      .upsert(
        {
          company_id: accessForm.companyId,
          user_id: selectedUser.user_id,
          status: accessForm.status,
        },
        { onConflict: "company_id,user_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    companyUserId = data.id;
  }

  const { error: deleteRolesError } = await supabase
    .from("company_user_roles")
    .delete()
    .eq("company_user_id", companyUserId);
  if (deleteRolesError) throw deleteRolesError;

  const { error: insertRoleError } = await supabase
    .from("company_user_roles")
    .insert({ company_user_id: companyUserId, role_id: accessForm.roleId });
  if (insertRoleError) throw insertRoleError;

  const { error: deleteOverridesError } = await supabase
    .from("company_user_permissions")
    .delete()
    .eq("company_user_id", companyUserId);
  if (deleteOverridesError) throw deleteOverridesError;

  const overrideRows = Object.entries(permissionOverrides)
    .filter(([, effect]) => effect !== "INHERIT")
    .map(([permissionId, effect]) => ({
      company_user_id: companyUserId,
      permission_id: permissionId,
      effect,
    }));

  if (overrideRows.length > 0) {
    const { error: insertOverridesError } = await supabase
      .from("company_user_permissions")
      .insert(overrideRows);
    if (insertOverridesError) throw insertOverridesError;
  }
}
