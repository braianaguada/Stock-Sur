import { Suspense, lazy } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UsersAccessTable } from "@/features/users/components/UsersAccessTable";
import { UsersOverviewHeader } from "@/features/users/components/UsersOverviewHeader";
import { useUsersAccessManagement } from "@/features/users/hooks/useUsersAccessManagement";

const UserAccessDialog = lazy(() => import("@/features/users/components/UserAccessDialog").then((module) => ({ default: module.UserAccessDialog })));
const UserDetailDialog = lazy(() => import("@/features/users/components/UserDetailDialog").then((module) => ({ default: module.UserDetailDialog })));

function UsersDialogLoader() {
  return <div className="py-8 text-center text-sm text-muted-foreground">Cargando panel de usuario...</div>;
}

export default function UsersPage() {
  const { roles } = useAuth();
  const { toast } = useToast();
  const {
    accessDialogOpen,
    accessForm,
    canManage,
    companyOptions,
    companyRoleOptions,
    error,
    filter,
    filteredUsers,
    inheritedPermissionCount,
    inheritedRolePermissionIds,
    isLoading,
    onPermissionOverrideChange,
    openAccessDialog,
    overrideStats,
    overviewStats,
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
  } = useUsersAccessManagement({ roles, toast });

  if (!canManage) {
    return (
      <AppLayout>
        <div className="page-shell">
          <div className="surface-card-muted max-w-2xl px-5 py-4 text-sm text-foreground">
            Solo el superadmin puede acceder al panel de usuarios y permisos.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-shell">
        <UsersOverviewHeader
          filter={filter}
          overviewStats={overviewStats}
          search={search}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
        />

        <UsersAccessTable
          isLoading={isLoading}
          error={error}
          users={filteredUsers}
          onOpenUser={setSelectedUser}
          onOpenAccessDialog={openAccessDialog}
        />
      </div>

      {selectedUser ? (
        <Suspense fallback={<UsersDialogLoader />}>
          <UserDetailDialog
            open={!!selectedUser}
            selectedUser={selectedUser}
            onOpenChange={(open) => !open && setSelectedUser(null)}
            onOpenAccessDialog={openAccessDialog}
          />
        </Suspense>
      ) : null}

      {accessDialogOpen ? (
        <Suspense fallback={<UsersDialogLoader />}>
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
            onPermissionOverrideChange={onPermissionOverrideChange}
            onSave={() => saveAccessMutation.mutate()}
          />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}
