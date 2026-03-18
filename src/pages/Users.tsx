import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck, Building2, Mail, User2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canManageUsers } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";

interface UserCompanyAccess {
  companyUserId: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  status: string;
  roles: string[];
}

interface UserAccessRow {
  user_id: string;
  email: string;
  full_name: string | null;
  global_roles: string[];
  companies: UserCompanyAccess[];
}

export default function UsersPage() {
  const { roles } = useAuth();
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["users-access-list"],
    enabled: canManageUsers(roles),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_access");
      if (error) throw error;
      return (data ?? []) as unknown as UserAccessRow[];
    },
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return data;

    return data.filter((user) => {
      const haystack = [
        user.full_name ?? "",
        user.email ?? "",
        ...(user.global_roles ?? []),
        ...(user.companies ?? []).flatMap((company) => [company.companyName, company.companySlug, ...(company.roles ?? [])]),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data, search]);

  const totalCompaniesAssigned = useMemo(
    () => data.reduce((sum, user) => sum + (user.companies?.length ?? 0), 0),
    [data],
  );

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
            <CardContent className="text-3xl font-bold text-emerald-950">{data.length}</CardContent>
          </Card>
          <Card className="border-sky-200/70 bg-sky-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-sky-900">Empresas asignadas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-sky-950">{totalCompaniesAssigned}</CardContent>
          </Card>
          <Card className="border-violet-200/70 bg-violet-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-violet-900">Superadmins</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-violet-950">
              {data.filter((user) => user.global_roles?.includes("superadmin")).length}
            </CardContent>
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

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Roles globales</TableHead>
                <TableHead>Empresas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-destructive">
                    {getErrorMessage(error)}
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
