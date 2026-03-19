import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, Mail, User2, Eye } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Roles globales</TableHead>
                <TableHead>Empresas</TableHead>
                <TableHead className="w-[96px] text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-destructive">
                    {getErrorMessage(error)}
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No se encontraron usuarios con ese filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <User2 className="h-4 w-4 text-muted-foreground" />
                          {user.full_name?.trim() || "Sin nombre cargado"}
                          {(user.companies?.length ?? 0) === 0 ? <Badge variant="outline">Sin empresa</Badge> : null}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-2">
                        {user.global_roles?.length ? (
                          user.global_roles.map((role) => (
                            <Badge key={role} variant={role === "superadmin" ? "default" : "secondary"}>
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin roles globales</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        {user.companies?.length ? (
                          user.companies.map((company) => (
                            <div key={company.companyUserId} className="rounded-xl border bg-muted/20 px-3 py-2">
                              <div className="flex items-center gap-2 font-medium">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                {company.companyName}
                                <Badge variant={company.status === "ACTIVE" ? "outline" : "destructive"}>
                                  {company.status === "ACTIVE" ? "Activa" : "Inactiva"}
                                </Badge>
                                {company.roles?.[0] ? (
                                  <Badge variant="secondary" className="hidden sm:inline-flex">
                                    {company.roles[0]}
                                  </Badge>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="ml-auto h-8 w-8"
                                  onClick={() => openAccessDialog(user, company)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {company.roles?.length ? (
                                  company.roles.map((role) => (
                                    <Badge key={`${company.companyUserId}-${role}`} variant="secondary">
                                      {role}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sin rol base</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin empresas asignadas</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedUser(user)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <UserDetailDialog
        open={!!selectedUser}
        selectedUser={selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        onOpenAccessDialog={openAccessDialog}
      />
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Gestionar acceso por empresa</DialogTitle>
            <DialogDescription>
              Definí la empresa, el rol base y el estado de la membresía para este usuario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/20 px-4 py-3">
              <p className="font-medium">{selectedUser?.full_name?.trim() || "Sin nombre cargado"}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
            </div>

            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={accessForm.companyId}
                onValueChange={(value) => setAccessForm((current) => ({ ...current, companyId: value }))}
                disabled={Boolean(accessForm.companyUserId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companyOptions.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accessForm.companyUserId ? (
                <p className="text-xs text-muted-foreground">
                  Para cambiar de empresa, creá una membresía nueva en vez de editar la actual.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Rol base</Label>
                <Select
                  value={accessForm.roleId}
                  onValueChange={(value) => setAccessForm((current) => ({ ...current, roleId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyRoleOptions.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={accessForm.status}
                  onValueChange={(value: "ACTIVE" | "INACTIVE") =>
                    setAccessForm((current) => ({ ...current, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Activa</SelectItem>
                    <SelectItem value="INACTIVE">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Permisos adicionales</p>
                <p className="text-sm text-muted-foreground">
                  El rol base sigue dando permisos heredados. Acá solo definís excepciones puntuales.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-emerald-200/70 bg-emerald-50/60 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-emerald-900">Heredados</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-emerald-950">{inheritedPermissionCount}</CardContent>
                </Card>
                <Card className="border-sky-200/70 bg-sky-50/60 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-sky-900">Permitir</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-sky-950">{overrideStats.allow}</CardContent>
                </Card>
                <Card className="border-rose-200/70 bg-rose-50/60 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-rose-900">Denegar</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-rose-950">{overrideStats.deny}</CardContent>
                </Card>
              </div>

              <div className="max-h-[320px] space-y-4 overflow-y-auto rounded-2xl border bg-muted/10 p-4">
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                  <div key={moduleName} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {moduleName}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {modulePermissions.map((permission) => {
                        const overrideValue = permissionOverrides[permission.id] ?? "INHERIT";
                        const inherited = inheritedRolePermissionIds.includes(permission.id);

                        return (
                          <div
                            key={permission.id}
                            className="grid gap-3 rounded-xl border bg-background px-3 py-3 md:grid-cols-[1.2fr_180px]"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{permission.description ?? permission.code}</p>
                                {inherited ? <Badge variant="outline">Heredado por rol</Badge> : null}
                                {overrideValue === "ALLOW" ? <Badge className="bg-sky-600 hover:bg-sky-600">Permitido</Badge> : null}
                                {overrideValue === "DENY" ? <Badge variant="destructive">Denegado</Badge> : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{permission.code}</p>
                            </div>
                            <Select
                              value={overrideValue}
                              onValueChange={(value: "ALLOW" | "DENY" | "INHERIT") =>
                                setPermissionOverrides((current) => ({
                                  ...current,
                                  [permission.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INHERIT">Heredar</SelectItem>
                                <SelectItem value="ALLOW">Permitir</SelectItem>
                                <SelectItem value="DENY">Denegar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveAccessMutation.mutate()} disabled={saveAccessMutation.isPending}>
              {saveAccessMutation.isPending ? "Guardando..." : "Guardar acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


