import { Link, useLocation } from "react-router-dom";
import { LogOut, Package, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { canManageUsers, canViewSettings } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/" },
  { title: "Items", url: "/items" },
  { title: "Stock", url: "/stock" },
  { title: "Proveedores", url: "/suppliers" },
  { title: "Precios", url: "/price-lists" },
  { title: "Documentos", url: "/documents" },
  { title: "Caja", url: "/cash" },
  { title: "Clientes", url: "/customers" },
  { title: "Usuarios", url: "/users", requiresSuperadmin: true },
  { title: "Configuración", url: "/settings", requiresAdmin: true },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { toast } = useToast();
  const {
    signOut,
    user,
    actorUser,
    roles,
    companies,
    currentCompany,
    companyRoleCodes,
    companyPermissionCodes,
    setCurrentCompanyId,
    isImpersonating,
    impersonationMeta,
    stopImpersonation,
  } = useAuth();
  const { settings } = useCompanyBrand();

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonation();
      toast({
        title: "Sesion restaurada",
        description: `Volviste a operar como ${actorUser?.email ?? "tu usuario real"}.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo volver a tu sesion",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.requiresSuperadmin) return canManageUsers(roles);
    if (item.requiresAdmin) return canViewSettings(roles, { companyRoleCodes, companyPermissionCodes });
    return true;
  });

  const userInitial = (user?.email?.[0] ?? currentCompany?.name?.[0] ?? "S").toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/55 bg-background/78 backdrop-blur-2xl">
      <div className="mx-auto max-w-[1720px] px-5 lg:px-8">
        <div className="flex flex-col gap-3 py-3">
          {isImpersonating ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-amber-500/15 p-2 text-amber-700">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Estás operando como {impersonationMeta?.targetEmail ?? user?.email ?? "usuario impersonado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sesión real: {actorUser?.email ?? impersonationMeta?.actorEmail ?? "superadmin"}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void handleStopImpersonation()}>
                Volver a mi sesión
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              {settings.logo_url ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-xs)] ring-1 ring-border/50">
                  <img src={settings.logo_url} alt={settings.app_name} className="h-full w-full object-contain p-1.5" />
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Package className="h-4 w-4" />
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{currentCompany?.name ?? settings.app_name}</p>
                <p className="truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground/85">Gestión comercial</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <div className="hidden items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground xl:flex">
                <span className="h-2 w-2 rounded-full bg-success" />
                Empresa activa
              </div>

              {companies.length > 1 ? (
                <div className="w-[230px] max-w-full">
                  <Select value={currentCompany?.id ?? undefined} onValueChange={setCurrentCompanyId}>
                    <SelectTrigger className="h-10 rounded-full border-border/55 bg-card/66 px-3.5 text-sm shadow-none hover:bg-accent/45">
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
                </div>
              ) : null}

              <div className="flex items-center gap-2 rounded-full border border-border/55 bg-card/70 p-1 pl-1.5 shadow-[var(--shadow-xs)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {userInitial}
                </div>
                <div className="hidden max-w-[180px] min-w-0 pr-1 lg:block">
                  <p className="truncate text-sm text-foreground">{user?.email ?? "Usuario"}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-accent/65 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <nav className="border-t border-border/40 pt-2">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5 xl:justify-start">
              {visibleNavItems.map((item) => {
                const isActive =
                  location.pathname === item.url ||
                  (item.url !== "/" && location.pathname.startsWith(item.url));

                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative rounded-full px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/35 hover:text-foreground",
                      isActive && "text-foreground",
                    )}
                  >
                    {item.title}
                    <span
                      className={cn(
                        "absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary transition-opacity duration-200",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
