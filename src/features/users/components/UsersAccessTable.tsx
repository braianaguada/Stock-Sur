import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Eye, Mail, Pencil, User2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import type { UserAccessRow, UserCompanyAccess } from "@/features/users/types";
import { DataCard } from "@/components/ui/page";

export function UsersAccessTable(props: {
  isLoading: boolean;
  error: unknown;
  users: UserAccessRow[];
  onOpenUser: (user: UserAccessRow) => void;
  onOpenAccessDialog: (user: UserAccessRow, company?: UserCompanyAccess) => void;
}) {
  const { isLoading, error, users, onOpenUser, onOpenAccessDialog } = props;

  const columns = useMemo<ColumnDef<UserAccessRow, unknown>[]>(() => [
    {
      accessorKey: "email",
      header: () => "Usuario",
      cell: ({ row }) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <User2 className="h-4 w-4 text-muted-foreground" />
            {row.original.full_name?.trim() || "Sin nombre cargado"}
            {(row.original.companies?.length ?? 0) === 0 ? <Badge variant="outline">Sin empresa</Badge> : null}
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
              <Badge key={role} variant={role === "superadmin" ? "default" : "secondary"}>
                {role}
              </Badge>
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
                        <p className="truncate font-semibold text-foreground">{company.companyName}</p>
                        <Badge variant={company.status === "ACTIVE" ? "outline" : "destructive"}>
                          {company.status === "ACTIVE" ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <span>{company.companySlug}</span>
                        <span>-</span>
                        <span>{company.roles?.length ?? 0} roles</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full"
                    onClick={() => onOpenAccessDialog(row.original, company)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
      ),
      meta: {
        cellClassName: "align-top",
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Detalle</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onOpenUser(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: {
        className: "w-[96px]",
        cellClassName: "align-top",
      },
    },
  ], [onOpenAccessDialog, onOpenUser]);

  return (
    <DataCard>
      <DataTable
        columns={columns}
        data={error ? [] : users}
        isLoading={isLoading}
        loadingMessage="Cargando usuarios..."
        emptyMessage={error ? getErrorMessage(error) : "No se encontraron usuarios con ese filtro."}
      />
    </DataCard>
  );
}
