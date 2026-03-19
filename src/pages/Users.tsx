import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { canManageUsers } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";
import {
  type AccessFormState,
  type CompanyOption,
  type CompanyRoleOption,
  type PermissionOption,
  type PermissionOverrideState,
  type UserAccessRow,
  type UserCompanyAccess,
  type UsersFilter,
} from "@/features/users/types";
import {
  buildAccessFormState,
  buildPermissionOverridesState,
  buildPermissionOverrideStats,
  buildUsersOverviewStats,
  filterUsersAccessList,
  groupPermissionsByModule,
} from "@/features/users/utils";
import {
  listActiveCompanies,
  listCompanyPermissionOverrides,
  listCompanyRoles,
  listPermissionOptions,
  listRolePermissionIds,
  listUsersWithAccess,
  syncSelectedUserAccess,
} from "@/features/users/queries";
import { saveUserCompanyAccess } from "@/features/users/mutations";
import { UserAccessDialog } from "@/features/users/components/UserAccessDialog";
import { UsersAccessTable } from "@/features/users/components/UsersAccessTable";
import { UserDetailDialog } from "@/features/users/components/UserDetailDialog";

export default function UsersPage() {
  const { roles } = useAuth();
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
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["users-access-list"],
    enabled: canManageUsers(roles),
    queryFn: listUsersWithAccess,
  });

  const { data: companyOptions = [] } = useQuery({
    queryKey: ["users-company-options"],
    enabled: canManageUsers(roles),
    queryFn: listActiveCompanies,
  });

  const { data: companyRoleOptions = [] } = useQuery({
    queryKey: ["users-company-role-options"],
    enabled: canManageUsers(roles),
    queryFn: listCompanyRoles,
  });

  const { data: permissionOptions = [] } = useQuery({
    queryKey: ["users-permission-options"],
    enabled: canManageUsers(roles),
    queryFn: listPermissionOptions,
  });

  const { data: inheritedRolePermissionIds = [] } = useQuery({
    queryKey: ["users-role-permissions", accessForm.roleId || "no-role"],
    enabled: Boolean(accessDialogOpen && accessForm.roleId),
    queryFn: () => listRolePermissionIds(accessForm.roleId),
  });

  const { data: existingPermissionOverrides = [] } = useQuery({
    queryKey: ["users-company-permission-overrides", accessForm.companyUserId ?? "new-membership"],
    enabled: Boolean(accessDialogOpen && accessForm.companyUserId),
    queryFn: () => listCompanyPermissionOverrides(accessForm.companyUserId!),
  });

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

  const permissionsByModule = useMemo(() => groupPermissionsByModule(permissionOptions), [permissionOptions]);

  const overrideStats = useMemo(() => buildPermissionOverrideStats(permissionOverrides), [permissionOverrides]);

  const inheritedPermissionCount = inheritedRolePermissionIds.length;

  const openAccessDialog = (user: UserAccessRow, company?: UserCompanyAccess) => {
    setSelectedUser(user);
    setAccessForm(buildAccessFormState(companyRoleOptions, company));
    setPermissionOverrides({});
    setAccessDialogOpen(true);
  };

  if (!canManageUsers(roles)) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Solo el superadmin puede acceder al panel de usuarios y permisos.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
            <p className="text-muted-foreground">
              Vista general de usuarios, empresas asignadas y roles globales.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Administracion global
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-200/70 bg-emerald-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900">Usuarios totales</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-emerald-950">{overviewStats.totalUsers}</CardContent>
          </Card>
          <Card className="border-sky-200/70 bg-sky-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-sky-900">Empresas asignadas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-sky-950">{overviewStats.totalCompaniesAssigned}</CardContent>
          </Card>
          <Card className="border-violet-200/70 bg-violet-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-violet-900">Superadmins</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-violet-950">{overviewStats.totalSuperadmins}</CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email, empresa o rol..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="ALL">Todos</TabsTrigger>
            <TabsTrigger value="SUPERADMINS">Superadmins</TabsTrigger>
            <TabsTrigger value="WITHOUT_COMPANY">Sin empresa</TabsTrigger>
            <TabsTrigger value="INACTIVE_MEMBERSHIPS">Con inactivas</TabsTrigger>
          </TabsList>
        </Tabs>

        <UsersAccessTable
          isLoading={isLoading}
          error={error}
          users={filteredUsers}
          onOpenUser={setSelectedUser}
          onOpenAccessDialog={openAccessDialog}
        />
      </div>

      <UserDetailDialog
        open={!!selectedUser}
        selectedUser={selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        onOpenAccessDialog={openAccessDialog}
      />
      <UserAccessDialog
        open={accessDialogOpen}
        selectedUser={selectedUser}
        accessForm={accessForm}
        companyOptions={companyOptions}
        companyRoleOptions={companyRoleOptions}
        permissionOptionsByModule={permissionsByModule}
        permissionOverrides={permissionOverrides}
        inheritedRolePermissionIds={inheritedRolePermissionIds}
        inheritedPermissionCount={inheritedPermissionCount}
        overrideStats={overrideStats}
        isSaving={saveAccessMutation.isPending}
        onOpenChange={setAccessDialogOpen}
        onAccessFormChange={(updater) => setAccessForm(updater)}
        onPermissionOverrideChange={(permissionId, value) => {
          setPermissionOverrides((current) => ({
            ...current,
            [permissionId]: value,
          }));
        }}
        onSave={() => saveAccessMutation.mutate()}
      />
    </AppLayout>
  );
}



