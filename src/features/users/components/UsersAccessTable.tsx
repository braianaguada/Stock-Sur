import { Building2, Eye, Mail, Pencil, User2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <DataCard>
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
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                No se encontraron usuarios con ese filtro.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell className="align-top">
                  <div className="space-y-1.5">
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
                  <div className="space-y-2.5">
                    {user.companies?.length ? (
                      user.companies.map((company) => (
                        <div key={company.companyUserId} className="rounded-[calc(var(--radius)+0.05rem)] border border-border/65 bg-card/78 p-3.5 shadow-[var(--shadow-xs)]">
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
                                  <span>•</span>
                                  <span>{company.roles?.length ?? 0} roles</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-full"
                              onClick={() => onOpenAccessDialog(user, company)}
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
                </TableCell>
                <TableCell className="text-right align-top">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onOpenUser(user)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </DataCard>
  );
}
