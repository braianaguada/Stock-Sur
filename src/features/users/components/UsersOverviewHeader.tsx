import { Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UsersFilter } from "@/features/users/types";
import { FilterBar, PageHeader } from "@/components/ui/page";

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
  const stats = [
    {
      label: "Usuarios totales",
      value: overviewStats.totalUsers,
      valueClassName: "text-emerald-400",
      borderClassName: "border-emerald-500/35",
    },
    {
      label: "Empresas asignadas",
      value: overviewStats.totalCompaniesAssigned,
      valueClassName: "text-sky-300",
      borderClassName: "border-sky-500/35",
    },
    {
      label: "Superadmins",
      value: overviewStats.totalSuperadmins,
      valueClassName: "text-foreground",
      borderClassName: "border-border/70",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administración global"
        title="Usuarios"
        subtitle="Vista general de usuarios, empresas asignadas y roles globales con una lectura más compacta, clara y ejecutiva."
        className="pb-4"
        meta={(
          <>
            <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px]">Acceso superadmin</Badge>
            <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px]">Permisos centralizados</Badge>
          </>
        )}
        actions={(
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-[hsl(var(--panel))]/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Administración global
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border bg-card/72 px-5 py-4 shadow-[var(--shadow-xs)] ${item.borderClassName}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold tracking-tight ${item.valueClassName}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <FilterBar className="items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            placeholder="Buscar por nombre, email, empresa o rol..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <Tabs value={filter} onValueChange={(value) => onFilterChange(value as UsersFilter)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-end gap-1 rounded-2xl p-1">
            <TabsTrigger value="ALL" className="h-8 rounded-xl px-3 text-xs">Todos</TabsTrigger>
            <TabsTrigger value="SUPERADMINS" className="h-8 rounded-xl px-3 text-xs">Superadmins</TabsTrigger>
            <TabsTrigger value="WITHOUT_COMPANY" className="h-8 rounded-xl px-3 text-xs">Sin empresa</TabsTrigger>
            <TabsTrigger value="INACTIVE_MEMBERSHIPS" className="h-8 rounded-xl px-3 text-xs">Con inactivas</TabsTrigger>
          </TabsList>
        </Tabs>
      </FilterBar>
    </>
  );
}
