import { Suspense, lazy, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UsersAccessTable } from "@/features/users/components/UsersAccessTable";
import { UsersOverviewHeader } from "@/features/users/components/UsersOverviewHeader";
import { CreateCompanyDialog } from "@/features/users/components/CreateCompanyDialog";
import { CompaniesManagementCard } from "@/features/users/components/CompaniesManagementCard";
import { useUsersAccessManagement } from "@/features/users/hooks/useUsersAccessManagement";
import { createCompany } from "@/features/users/mutations";
import { getErrorMessage } from "@/lib/errors";
import type { UserAccessRow } from "@/features/users/types";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";

const UserAccessDialog = lazy(() => import("@/features/users/components/UserAccessDialog").then((module) => ({ default: module.UserAccessDialog })));
const UserDetailDialog = lazy(() => import("@/features/users/components/UserDetailDialog").then((module) => ({ default: module.UserDetailDialog })));

function UsersDialogLoader() {
  return <div className="py-8 text-center text-sm text-muted-foreground">Cargando panel de usuario...</div>;
}

export default function UsersPage() {
  const { roles, actorUser, impersonationMeta, refreshCompanies, switchCompany, startImpersonation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"users" | "companies">("users");
  const [impersonationDialogUser, setImpersonationDialogUser] = useState<UserAccessRow | null>(null);
  const [impersonationReason, setImpersonationReason] = useState("");
  const [isStartingImpersonation, setIsStartingImpersonation] = useState(false);
  const {
    accessDialogOpen,
    accessSnapshotError,
    accessForm,
    canSaveAccess,
    canManage,
    companyOptions,
    companyRoleOptions,
    error,
    filter,
    filteredUsers,
    inheritedPermissionCount,
    inheritedRolePermissionIds,
    isAccessSnapshotLoading,
    isLoading,
    onPermissionOverrideChange,
    onAccessDialogOpenChange,
    openAccessDialog,
    overrideStats,
    overviewStats,
    permissionOverrides,
    permissionsByModule,
    saveAccessMutation,
    retryAccessSnapshot,
    search,
    selectedUser,
    setAccessForm,
    setFilter,
    setSearch,
    setSelectedUser,
  } = useUsersAccessManagement({ roles, toast });
  const createCompanyMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: async (company) => {
      await Promise.all([
        refreshCompanies(),
        queryClient.invalidateQueries({ queryKey: ["users-company-options"] }),
      ]);
      await switchCompany(company.id);
      setCreateCompanyOpen(false);
      toast({
        title: "Empresa creada",
        description: `${company.name} ya está disponible y no contiene datos de otras empresas.`,
      });
    },
    onError: (error) => {
      toast({
        title: "No se pudo crear la empresa",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleStartImpersonation = async () => {
    if (!impersonationDialogUser) return;

    setIsStartingImpersonation(true);
    try {
      await startImpersonation({
        targetUserId: impersonationDialogUser.user_id,
        targetEmail: impersonationDialogUser.email,
        reason: impersonationReason,
      });
      toast({
        title: "Impersonación iniciada",
        description: `Ahora estás operando como ${impersonationDialogUser.email}.`,
      });
      setImpersonationDialogUser(null);
      setImpersonationReason("");
    } catch (error) {
      toast({
        title: "No se pudo iniciar la impersonación",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsStartingImpersonation(false);
    }
  };

  if (!canManage) {
    return (
      <AppLayout>
        <PageContainer className="page-shell">
          <PageHeader eyebrow="Administración global" title="Usuarios" subtitle="Gestión restringida de identidades, empresas, roles y permisos." />
          <Card className="max-w-2xl border-warning/25 bg-warning/10 shadow-none">
            <CardContent className="p-5 text-sm text-foreground">Solo el superadmin puede acceder al panel de usuarios y permisos.</CardContent>
          </Card>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        <UsersOverviewHeader
          activeSection={activeSection}
          filter={filter}
          overviewStats={overviewStats}
          search={search}
          onSectionChange={setActiveSection}
          onFilterChange={setFilter}
          onCreateCompany={() => setCreateCompanyOpen(true)}
          onSearchChange={setSearch}
        />

        {activeSection === "users" ? (
          <UsersAccessTable
            isLoading={isLoading}
            error={error}
            users={filteredUsers}
            onOpenUser={setSelectedUser}
            onOpenAccessDialog={openAccessDialog}
            onOpenImpersonation={(user) => {
              setImpersonationReason("");
              setImpersonationDialogUser(user);
            }}
          />
        ) : (
          <CompaniesManagementCard />
        )}
      </PageContainer>

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
            isAccessSnapshotLoading={isAccessSnapshotLoading}
            accessSnapshotError={accessSnapshotError}
            canSave={canSaveAccess}
            onOpenChange={onAccessDialogOpenChange}
            onAccessFormChange={(updater) => setAccessForm(updater)}
            onPermissionOverrideChange={onPermissionOverrideChange}
            onRetry={() => void retryAccessSnapshot()}
            onSave={() => saveAccessMutation.mutate()}
          />
        </Suspense>
      ) : null}

      <AlertDialog
        open={!!impersonationDialogUser}
        onOpenChange={(open) => {
          if (!open) {
            setImpersonationDialogUser(null);
            setImpersonationReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar impersonación</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a operar con los permisos efectivos de <strong>{impersonationDialogUser?.email ?? "este usuario"}</strong>.
              {impersonationMeta ? ` La impersonación actual se reemplazará.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="impersonation-reason">Motivo</Label>
            <Textarea
              id="impersonation-reason"
              value={impersonationReason}
              onChange={(event) => setImpersonationReason(event.target.value)}
              placeholder="Ej: reproducir incidencia de permisos en documentos."
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Actor real: {actorUser?.email ?? "sin sesión"}. Todas las acciones deben quedar auditadas.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStartingImpersonation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                isStartingImpersonation ||
                !impersonationDialogUser ||
                impersonationDialogUser.user_id === actorUser?.id
              }
              onClick={(event) => {
                event.preventDefault();
                void handleStartImpersonation();
              }}
            >
              {isStartingImpersonation ? "Iniciando..." : "Impersonar usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateCompanyDialog
        open={createCompanyOpen}
        isCreating={createCompanyMutation.isPending}
        onOpenChange={setCreateCompanyOpen}
        onCreate={(values) => createCompanyMutation.mutate(values)}
      />
    </AppLayout>
  );
}
