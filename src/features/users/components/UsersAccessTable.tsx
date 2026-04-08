import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Eye, LogIn, Mail, Pencil, User2 } from "lucide-react";
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
  onOpenImpersonation: (user: UserAccessRow) => void;
}) {
  const { isLoading, error, users, onOpenUser, onOpenAccessDialog, onOpenImpersonation } = props;

  const columns = useMemo<ColumnDef<UserAccessRow, unknown>[]>(() => [
    {
      accessorKey: "email",
      header: () => "Usuario",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">{row.original.full_name?.trim() || "Sin nombre cargado"}</span>
            {(row.original.companies?.length ?? 0) === 0 ? (
              <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">Sin empresa</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{row.original.email}</span>
          </div>
        </div>
      ),
      meta: {
        className: "w-[290px]",
        cellClassName: "align-top",
      },
    },
    {
      accessorKey: "global_roles",
      header: () => "Roles globales",
      cell: ({ row }) => (
        <div className="flex min-h-8 flex-wrap items-start gap-1.5 pt-0.5">
          {row.original.global_roles?.length ? (
            row.original.global_roles.map((role) => (
              <Badge key={role} variant={role === "superadmin" ? "default" : "secondary"} className="h-5 rounded-full px-2 text-[10px]">
                {role}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sin roles globales</span>
          )}
        </div>
      ),
      meta: {
        className: "w-[160px]",
        cellClassName: "align-top",
      },
    },
    {
      accessorKey: "companies",
      header: () => "Empresas",
      cell: ({ row }) => (
        <div className="space-y-2">
          {row.original.companies?.length ? (
            row.original.companies.map((company) => (
              <div
                key={company.companyUserId}
                className="rounded-2xl border border-border/60 bg-card/66 px-3.5 py-3 shadow-[var(--shadow-xs)]"
              >
                <div className="flex flex-wrap items-start gap-2.5">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--panel))]/72 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{company.companyName}</p>
                        <Badge variant={company.status === "ACTIVE" ? "outline" : "destructive"} className="h-5 rounded-full px-2 text-[10px]">
                          {company.status === "ACTIVE" ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <span>{company.companySlug}</span>
                        <span>-</span>
                        <span>{company.roles?.length ?? 0} roles</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {company.roles?.length ? (
                          company.roles.map((role) => (
                            <Badge key={`${company.companyUserId}-${role}`} variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sin rol base</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => onOpenAccessDialog(row.original, company)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sin empresas asignadas</span>
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
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => onOpenImpersonation(row.original)}>
            <LogIn className="mr-1.5 h-3.5 w-3.5" />
            Impersonar
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onOpenUser(row.original)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      meta: {
        className: "w-[160px]",
        cellClassName: "align-top",
      },
    },
  ], [onOpenAccessDialog, onOpenImpersonation, onOpenUser]);

  return (
    <DataCard>
      <DataTable
        columns={columns}
        data={error ? [] : users}
        isLoading={isLoading}
        loadingMessage="Cargando usuarios..."
        emptyMessage={error ? getErrorMessage(error) : "No se encontraron usuarios con ese filtro."}
        rowClassName="align-top"
        cellClassName="py-3.5"
      />
    </DataCard>
  );
}
