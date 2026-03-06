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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCompanyBrand } from "@/contexts/company-brand-context";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Ítems", url: "/items", icon: Package },
  { title: "Stock", url: "/stock", icon: Warehouse },
  { title: "Proveedores", url: "/suppliers", icon: Truck },
  { title: "Listas de precios", url: "/price-lists", icon: FileSpreadsheet },
  { title: "Importar catálogo (sistema viejo)", url: "/items/catalog/import-legacy", icon: FolderUp },
  { title: "Pendientes", url: "/pending", icon: AlertCircle },
  { title: "Documentos", url: "/documents", icon: FileText },
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Configuracion", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useCompanyBrand();

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        {settings.logo_url ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90 p-1">
            <img src={settings.logo_url} alt={settings.app_name} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
            {settings.app_name}
          </span>
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

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.url ||
            (item.url !== "/" && location.pathname.startsWith(item.url));
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
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
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium w-full transition-colors",
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
