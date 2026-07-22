import { Building2, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UsersFilter } from "@/features/users/types";
import { FilterToolbar, PageHeader } from "@/components/ui/page";
import { InfoBadge, MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";

interface UsersOverviewHeaderProps {
  filter: UsersFilter;
  overviewStats: {
    totalUsers: number;
    totalCompaniesAssigned: number;
    totalSuperadmins: number;
  };
  search: string;
  onFilterChange: (value: UsersFilter) => void;
  onCreateCompany: () => void;
  onSearchChange: (value: string) => void;
}

export function UsersOverviewHeader({
  filter,
  overviewStats,
  search,
  onFilterChange,
  onCreateCompany,
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
            <StatusBadge tone="warning">Acceso superadmin</StatusBadge>
            <InfoBadge>Permisos centralizados</InfoBadge>
          </>
        )}
        actions={(
          <Button type="button" onClick={onCreateCompany}>
            <Plus className="h-4 w-4" />
            Nueva empresa
          </Button>
        )}
      />

      <MetricGrid columns={3}>
        <MetricCard label="Usuarios totales" value={overviewStats.totalUsers} format="plain" tone="success" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Empresas asignadas" value={overviewStats.totalCompaniesAssigned} format="plain" tone="info" icon={<Building2 className="h-5 w-5" />} />
        <MetricCard label="Superadmins" value={overviewStats.totalSuperadmins} format="plain" icon={<ShieldCheck className="h-5 w-5" />} />
      </MetricGrid>

      <FilterToolbar className="justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email, empresa o rol..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <Select value={filter} onValueChange={(value) => onFilterChange(value as UsersFilter)}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filtrar usuarios">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los usuarios</SelectItem>
            <SelectItem value="SUPERADMINS">Superadmins</SelectItem>
            <SelectItem value="WITHOUT_COMPANY">Sin empresa</SelectItem>
            <SelectItem value="INACTIVE_MEMBERSHIPS">Con membresías inactivas</SelectItem>
          </SelectContent>
        </Select>
      </FilterToolbar>
    </>
  );
}
