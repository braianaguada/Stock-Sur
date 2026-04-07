import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserAccessDialog } from "@/features/users/components/UserAccessDialog";
import { UsersAccessTable } from "@/features/users/components/UsersAccessTable";
import { UserDetailDialog } from "@/features/users/components/UserDetailDialog";
import { UsersOverviewHeader } from "@/features/users/components/UsersOverviewHeader";
import { useUsersAccessManagement } from "@/features/users/hooks/useUsersAccessManagement";

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
        onPermissionOverrideChange={onPermissionOverrideChange}
        onSave={() => saveAccessMutation.mutate()}
      />
    </AppLayout>
  );
}



