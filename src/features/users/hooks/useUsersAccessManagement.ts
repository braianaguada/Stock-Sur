import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { canManageUsers } from "@/lib/permissions";
import { saveUserCompanyAccess } from "@/features/users/mutations";
import {
  listActiveCompanies,
  listCompanyPermissionOverrides,
  listCompanyRoles,
  listPermissionOptions,
  listRolePermissionIds,
  listUsersWithAccess,
  syncSelectedUserAccess,
} from "@/features/users/queries";
import {
  buildAccessFormState,
  buildPermissionOverridesState,
  buildPermissionOverrideStats,
  buildUsersOverviewStats,
  filterUsersAccessList,
  groupPermissionsByModule,
} from "@/features/users/utils";
import type {
  AccessFormState,
  CompanyOption,
  CompanyRoleOption,
  PermissionOption,
  PermissionOverrideState,
  UserAccessRow,
  UserCompanyAccess,
  UsersFilter,
} from "@/features/users/types";

type ToastFn = (params: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

const EMPTY_USERS: UserAccessRow[] = [];
const EMPTY_COMPANIES: CompanyOption[] = [];
const EMPTY_ROLES: CompanyRoleOption[] = [];
const EMPTY_PERMISSIONS: PermissionOption[] = [];
const EMPTY_PERMISSION_IDS: string[] = [];

export function useUsersAccessManagement(params: {
  roles: string[];
  toast: ToastFn;
}) {
  const { roles, toast } = params;
  const canManage = canManageUsers(roles);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UsersFilter>("ALL");
  const [selectedUser, setSelectedUser] = useState<UserAccessRow | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessForm, setAccessForm] = useState<AccessFormState>({
    companyUserId: null,
    companyId: "",
    roleId: "",
    status: "ACTIVE",
  });
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverrideState>({});

  const usersQuery = useQuery({
    queryKey: ["users-access-list"],
    enabled: canManage,
    queryFn: listUsersWithAccess,
  });
  const data = usersQuery.data ?? EMPTY_USERS;

  const companyOptionsQuery = useQuery({
    queryKey: ["users-company-options"],
    enabled: canManage,
    queryFn: listActiveCompanies,
  });
  const companyOptions = companyOptionsQuery.data ?? EMPTY_COMPANIES;

  const companyRoleOptionsQuery = useQuery({
    queryKey: ["users-company-role-options"],
    enabled: canManage,
    queryFn: listCompanyRoles,
  });
  const companyRoleOptions = companyRoleOptionsQuery.data ?? EMPTY_ROLES;

  const permissionOptionsQuery = useQuery({
    queryKey: ["users-permission-options"],
    enabled: canManage,
    queryFn: listPermissionOptions,
  });
  const permissionOptions = permissionOptionsQuery.data ?? EMPTY_PERMISSIONS;

  const inheritedRolePermissionIdsQuery = useQuery({
    queryKey: ["users-role-permissions", accessForm.roleId || "no-role"],
    enabled: Boolean(accessDialogOpen && accessForm.roleId),
    queryFn: () => listRolePermissionIds(accessForm.roleId),
  });
  const inheritedRolePermissionIds = inheritedRolePermissionIdsQuery.data ?? EMPTY_PERMISSION_IDS;

  const existingPermissionOverridesQuery = useQuery({
    queryKey: ["users-company-permission-overrides", accessForm.companyUserId ?? "new-membership"],
    enabled: Boolean(accessDialogOpen && accessForm.companyUserId),
    queryFn: () => listCompanyPermissionOverrides(accessForm.companyUserId!),
  });
  const existingPermissionOverrides = existingPermissionOverridesQuery.data ?? EMPTY_PERMISSIONS;

  useEffect(() => {
    if (!accessDialogOpen) return;
    if (!accessForm.roleId && companyRoleOptions.length > 0) {
      setAccessForm((current) => ({ ...current, roleId: companyRoleOptions[0].id }));
    }
  }, [accessDialogOpen, accessForm.roleId, companyRoleOptions]);

  useEffect(() => {
    if (!accessDialogOpen) return;
    setPermissionOverrides(buildPermissionOverridesState(permissionOptions, existingPermissionOverrides));
  }, [accessDialogOpen, existingPermissionOverrides, permissionOptions]);

  const usersById = useMemo(
    () => new Map(data.map((user) => [user.user_id, user])),
    [data],
  );
  const companyOptionsById = useMemo(
    () => new Map(companyOptions.map((company) => [company.id, company])),
    [companyOptions],
  );
  const companyRolesById = useMemo(
    () => new Map(companyRoleOptions.map((role) => [role.id, role])),
    [companyRoleOptions],
  );

  const saveAccessMutation = useMutation({
    mutationFn: () =>
      saveUserCompanyAccess({
        selectedUser,
        accessForm,
        permissionOverrides,
        hasSelectedUser: Boolean(selectedUser && usersById.has(selectedUser.user_id)),
        hasCompany: companyOptionsById.has(accessForm.companyId),
        hasRole: companyRolesById.has(accessForm.roleId),
      }),
    onSuccess: async () => {
      if (!selectedUser) return;
      const refreshedUser = await syncSelectedUserAccess(qc, selectedUser.user_id);
      setSelectedUser(refreshedUser);
      setAccessDialogOpen(false);
      toast({ title: "Acceso actualizado" });
    },
    onError: (error: unknown) =>
      toast({
        title: "No se pudo actualizar el acceso",
        description: getErrorMessage(error),
        variant: "destructive",
      }),
  });

  const filteredUsers = useMemo(() => filterUsersAccessList(data, filter, search), [data, filter, search]);
  const overviewStats = useMemo(() => buildUsersOverviewStats(data), [data]);
  const permissionsByModule = useMemo(() => groupPermissionsByModule(permissionOptions), [permissionOptions]);
  const overrideStats = useMemo(() => buildPermissionOverrideStats(permissionOverrides), [permissionOverrides]);
  const inheritedPermissionCount = inheritedRolePermissionIds.length;

  const openAccessDialog = (user: UserAccessRow, company?: UserCompanyAccess) => {
    setSelectedUser(user);
    setAccessForm(buildAccessFormState(companyRoleOptions, company));
    setPermissionOverrides({});
    setAccessDialogOpen(true);
  };

  const onPermissionOverrideChange = (permissionId: string, value: boolean | null) => {
    setPermissionOverrides((current) => ({
      ...current,
      [permissionId]: value,
    }));
  };

  return {
    accessDialogOpen,
    accessForm,
    canManage,
    companyOptions,
    companyRoleOptions,
    error: usersQuery.error,
    filter,
    filteredUsers,
    inheritedPermissionCount,
    inheritedRolePermissionIds,
    isLoading: usersQuery.isLoading,
    onPermissionOverrideChange,
    openAccessDialog,
    overrideStats,
    permissionOverrides,
    permissionsByModule,
    saveAccessMutation,
    search,
    selectedUser,
    setAccessDialogOpen,
    setAccessForm,
    setFilter,
    setSearch,
    setSelectedUser,
    overviewStats,
  };
}
