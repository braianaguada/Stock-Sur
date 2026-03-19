import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Truck,
  FileSpreadsheet,
  FolderUp,
  AlertCircle,
  FileText,
  Users,
  LogOut,
  ChevronLeft,
  Settings,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { canManageUsers, canViewSettings } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Ítems", url: "/items", icon: Package },
  { title: "Stock", url: "/stock", icon: Warehouse },
  { title: "Proveedores", url: "/suppliers", icon: Truck },
  { title: "Listas de precios", url: "/price-lists", icon: FileSpreadsheet },
  { title: "Importar catálogo (sistema viejo)", url: "/items/catalog/import-legacy", icon: FolderUp },
  { title: "Pendientes", url: "/pending", icon: AlertCircle },
  { title: "Documentos", url: "/documents", icon: FileText },
  { title: "Caja", url: "/cash", icon: Wallet },
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Usuarios", url: "/users", icon: ShieldCheck, requiresSuperadmin: true },
  { title: "Configuracion", url: "/settings", icon: Settings, requiresAdmin: true },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user, roles, companies, currentCompany, setCurrentCompanyId } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useCompanyBrand();
  const visibleNavItems = navItems.filter((item) => {
    if (item.requiresSuperadmin) return canManageUsers(roles);
    if (item.requiresAdmin) return canViewSettings(roles);
    return true;
  });

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="border-b border-sidebar-border bg-gradient-to-b from-white/5 to-transparent px-4 py-4">
        <div className="flex items-center gap-3">
        {settings.logo_url ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90 p-1 shadow-sm">
            <img src={settings.logo_url} alt={settings.app_name} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tracking-tight text-sidebar-accent-foreground">{settings.app_name}</p>
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
              {currentCompany?.name ?? "Panel operativo"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "ml-auto h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "mx-auto ml-0"
          )}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
        </div>
        {!collapsed && companies.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Empresa actual</p>
            {companies.length === 1 ? (
              <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/50 px-3 py-2">
                <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{companies[0].name}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">{companies[0].slug}</p>
              </div>
            ) : (
              <Select value={currentCompany?.id ?? undefined} onValueChange={setCurrentCompanyId}>
                <SelectTrigger className="h-11 rounded-xl border-sidebar-border/80 bg-sidebar-accent/50 text-sidebar-accent-foreground">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive =
            location.pathname === item.url ||
            (item.url !== "/" && location.pathname.startsWith(item.url));
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sidebar-primary" />}
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-3">
        <button
          onClick={signOut}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-colors",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        {!collapsed && user && (
          <p className="px-3 mt-2 text-xs text-sidebar-foreground truncate">{user.email}</p>
        )}
      </div>
    </aside>
  );
}
