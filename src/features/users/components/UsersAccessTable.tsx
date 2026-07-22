import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Eye, LogIn, Mail, Pencil, User2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errors";
import type { UserAccessRow, UserCompanyAccess } from "@/features/users/types";
import { CategoryBadge, CountBadge, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";

export function UsersAccessTable(props: {
  isLoading: boolean;
  error: unknown;
  users: UserAccessRow[];
  onOpenUser: (user: UserAccessRow) => void;
  onOpenAccessDialog: (user: UserAccessRow, company?: UserCompanyAccess) => void;
  onOpenImpersonation: (user: UserAccessRow) => void;
}) {
  const { isLoading, error, users, onOpenUser, onOpenAccessDialog, onOpenImpersonation } = props;

  const columns = useMemo<ColumnDef<UserAccessRow, unknown>[]>(() => [
    {
      accessorKey: "email",
      header: () => "Usuario",
      cell: ({ row }) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <User2 className="h-4 w-4 text-muted-foreground" />
            {row.original.full_name?.trim() || "Sin nombre cargado"}
            {(row.original.companies?.length ?? 0) === 0 ? <StatusBadge tone="warning">Sin empresa</StatusBadge> : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            {row.original.email}
          </div>
        </div>
      ),
      meta: {
        cellClassName: "align-top",
      },
    },
    {
      accessorKey: "global_roles",
      header: () => "Roles globales",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {row.original.global_roles?.length ? (
            row.original.global_roles.map((role) => (
              <CategoryBadge key={role}>
                {role}
              </CategoryBadge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Sin roles globales</span>
          )}
        </div>
      ),
      meta: {
        cellClassName: "align-top",
      },
    },
    {
      accessorKey: "companies",
      header: () => "Empresas",
      cell: ({ row }) => (
        <div className="space-y-2.5">
          {row.original.companies?.length ? (
            row.original.companies.map((company) => (
              <div
                key={company.companyUserId}
                className="rounded-[calc(var(--radius)+0.05rem)] border border-border/65 bg-card/78 p-3.5 shadow-[var(--shadow-xs)]"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--panel))]/72 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PrimaryCell title={company.companyName} metadata={`${company.companySlug} · ${company.roles?.length ?? 0} roles`} />
                        <StatusBadge tone={company.status === "ACTIVE" ? "success" : "danger"}>
                          {company.status === "ACTIVE" ? "Activa" : "Inactiva"}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                  <RowActionButton label={`Editar acceso en ${company.companyName}`} tone="edit" onClick={() => onOpenAccessDialog(row.original, company)}>
                    <Pencil className="h-4 w-4" />
                  </RowActionButton>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {company.roles?.length ? (
                    company.roles.map((role) => (
                      <CategoryBadge key={`${company.companyUserId}-${role}`}>
                        {role}
                      </CategoryBadge>
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
      ),
      meta: {
        cellClassName: "align-top",
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <RowActions>
          <RowActionButton label={`Impersonar a ${row.original.email}`} tone="warning" onClick={() => onOpenImpersonation(row.original)}>
            <LogIn className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton label={`Ver detalle de ${row.original.email}`} tone="view" onClick={() => onOpenUser(row.original)}>
            <Eye className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
      meta: {
        className: "w-[112px]",
        cellClassName: "align-top",
      },
    },
  ], [onOpenAccessDialog, onOpenImpersonation, onOpenUser]);

  return (
    <Card className="min-w-0 border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Accesos de usuarios</CardTitle>
          <CardDescription>Roles globales, membresías y permisos efectivos por empresa.</CardDescription>
        </div>
        <CountBadge>{users.length} {users.length === 1 ? "usuario" : "usuarios"}</CountBadge>
      </CardHeader>
      <CardContent className="p-0">
      <DataTable
        columns={columns}
        data={error ? [] : users}
        isLoading={isLoading}
        loadingMessage="Cargando usuarios..."
        emptyMessage={error ? getErrorMessage(error) : "No se encontraron usuarios con ese filtro."}
      />
      </CardContent>
    </Card>
  );
}
