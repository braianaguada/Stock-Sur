import { Building2, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UsersFilter } from "@/features/users/types";
import { FilterToolbar, PageHeader } from "@/components/ui/page";
import { InfoBadge, MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";

interface UsersOverviewHeaderProps {
  activeSection: "users" | "companies";
  filter: UsersFilter;
  overviewStats: {
    totalUsers: number;
    totalCompaniesAssigned: number;
    totalSuperadmins: number;
  };
  search: string;
  onSectionChange: (value: "users" | "companies") => void;
  onFilterChange: (value: UsersFilter) => void;
  onCreateCompany: () => void;
  onSearchChange: (value: string) => void;
}

export function UsersOverviewHeader({
  activeSection,
  filter,
  overviewStats,
  search,
  onSectionChange,
  onFilterChange,
  onCreateCompany,
  onSearchChange,
}: UsersOverviewHeaderProps) {
  return (
    <>
      <PageHeader
        eyebrow="Administración global"
        title="Usuarios y empresas"
        subtitle="Administrá identidades, membresías y empresas desde un espacio centralizado."
        variant="workspace"
        tabs={[
          { label: "Usuarios y accesos", value: "users" },
          { label: "Empresas", value: "companies" },
        ]}
        activeTab={activeSection}
        onTabChange={(value) => onSectionChange(value as "users" | "companies")}
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

      {activeSection === "users" ? (
        <>
          <MetricGrid columns={3}>
            <MetricCard label="Usuarios totales" value={overviewStats.totalUsers} format="plain" tone="success" icon={<Users className="h-5 w-5" />} />
            <MetricCard label="Empresas asignadas" value={overviewStats.totalCompaniesAssigned} format="plain" tone="info" icon={<Building2 className="h-5 w-5" />} />
            <MetricCard label="Superadmins" value={overviewStats.totalSuperadmins} format="plain" icon={<ShieldCheck className="h-5 w-5" />} />
          </MetricGrid>

          <FilterToolbar className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar usuarios"
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
      ) : null}
    </>
  );
}
