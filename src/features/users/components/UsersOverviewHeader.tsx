import { Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UsersFilter } from "@/features/users/types";
import { FilterBar, PageHeader, StatCard } from "@/components/ui/page";

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
      <PageHeader
        eyebrow="Administración global"
        title="Usuarios"
        subtitle="Vista general de usuarios, empresas asignadas y roles globales. Se mantiene la potencia de gestión, con una lectura más clara y ejecutiva."
        meta={(
          <>
            <Badge variant="outline">Acceso superadmin</Badge>
            <Badge variant="secondary">Permisos centralizados</Badge>
          </>
        )}
        actions={(
          <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--panel))]/70 px-4 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Administración global
          </div>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Usuarios totales" value={overviewStats.totalUsers} tone="success" />
        <StatCard label="Empresas asignadas" value={overviewStats.totalCompaniesAssigned} tone="info" />
        <StatCard label="Superadmins" value={overviewStats.totalSuperadmins} />
      </div>

      <FilterBar className="justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email, empresa o rol..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <Tabs value={filter} onValueChange={(value) => onFilterChange(value as UsersFilter)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-end gap-1.5 rounded-2xl p-1">
            <TabsTrigger value="ALL">Todos</TabsTrigger>
            <TabsTrigger value="SUPERADMINS">Superadmins</TabsTrigger>
            <TabsTrigger value="WITHOUT_COMPANY">Sin empresa</TabsTrigger>
            <TabsTrigger value="INACTIVE_MEMBERSHIPS">Con inactivas</TabsTrigger>
          </TabsList>
        </Tabs>
      </FilterBar>
    </>
  );
}
