import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UsersFilter } from "@/features/users/types";

interface UsersOverviewHeaderProps {
  filter: UsersFilter;
  overviewStats: {
    totalUsers: number;
    totalCompaniesAssigned: number;
    totalSuperadmins: number;
  };
  search: string;
  onFilterChange: (value: UsersFilter) => void;
  onSearchChange: (value: string) => void;
}

export function UsersOverviewHeader({
  filter,
  overviewStats,
  search,
  onFilterChange,
  onSearchChange,
}: UsersOverviewHeaderProps) {
  return (
    <>
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
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <Tabs value={filter} onValueChange={(value) => onFilterChange(value as UsersFilter)}>
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="ALL">Todos</TabsTrigger>
          <TabsTrigger value="SUPERADMINS">Superadmins</TabsTrigger>
          <TabsTrigger value="WITHOUT_COMPANY">Sin empresa</TabsTrigger>
          <TabsTrigger value="INACTIVE_MEMBERSHIPS">Con inactivas</TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  );
}
