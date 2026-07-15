import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StockSurMark } from "@/components/StockSurMark";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { canManageUsers, canViewBilling, canViewSettings, canViewSettlements } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { billingFeatureEnabled } from "@/lib/features";

const navItems = [
  { title: "Dashboard", url: "/" },
  { title: "Items", url: "/items" },
  { title: "Combos", url: "/combos" },
  { title: "Stock", url: "/stock" },
  { title: "Proveedores", url: "/suppliers" },
  { title: "Ordenes de compra", url: "/purchase-orders" },
  { title: "Precios", url: "/price-lists" },
  { title: "Documentos", url: "/documents" },
  { title: "Servicios", url: "/services/documents" },
  { title: "Trabajos", url: "/service-jobs" },
  { title: "Tecnicos", url: "/technicians" },
  { title: "Totales", url: "/cash-totals" },
  { title: "Caja", url: "/cash" },
  { title: "Rendiciones", url: "/settlements", requiresSettlements: true },
  { title: "Facturacion", url: "/billing", requiresBilling: true },
  { title: "Clientes", url: "/customers" },
  { title: "Estado de cuenta", url: "/customer-account" },
  { title: "Usuarios", url: "/users", requiresSuperadmin: true },
  { title: "Configuración", url: "/settings", requiresAdmin: true },
] as const;

const navGroups = [
  { title: "Comercial", domainClassName: "domain-commercial", urls: ["/documents", "/customers", "/customer-account", "/billing"] },
  { title: "Inventario", domainClassName: "domain-inventory", urls: ["/items", "/combos", "/stock", "/price-lists"] },
  { title: "Compras", domainClassName: "domain-purchases", urls: ["/suppliers", "/purchase-orders"] },
  { title: "Servicios", domainClassName: "domain-services", urls: ["/services/documents", "/service-jobs", "/technicians"] },
  { title: "Finanzas", domainClassName: "domain-cash", urls: ["/cash", "/cash-totals", "/settlements"] },
  { title: "Administración", domainClassName: "domain-admin", urls: ["/users", "/settings"] },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const [modulesOpen, setModulesOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    switchCompany,
    switchingCompany,
    isImpersonating,
    impersonationMeta,
    stopImpersonation,
  } = useAuth();
  const { settings } = useCompanyBrand();

  const handleCompanyChange = async (companyId: string) => {
    if (!companyId || companyId === currentCompany?.id || switchingCompany) return;

    try {
      const nextCompany = await switchCompany(companyId);
      queryClient.clear();
      navigate("/", { replace: true });
      toast({
        title: "Empresa activa actualizada",
        description: `Ahora operas con ${nextCompany.name}.`,
      });
    } catch (error) {
      queryClient.clear();
      navigate("/", { replace: true });
      toast({
        title: "No se pudo cambiar de empresa",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

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
    if (item.requiresBilling) {
      return billingFeatureEnabled && canViewBilling(roles, { companyRoleCodes, companyPermissionCodes });
    }
    if (item.requiresSettlements) {
      return canViewSettlements(roles, { companyRoleCodes, companyPermissionCodes });
    }
    return true;
  });

  const userInitial = (user?.email?.[0] ?? currentCompany?.name?.[0] ?? "S").toUpperCase();

  const isItemActive = (url: string) =>
    location.pathname === url || (url !== "/" && location.pathname.startsWith(`${url}/`));
  const activeItem = visibleNavItems.find((item) => isItemActive(item.url));

  return (
    <header className="sticky top-0 z-40 border-b border-border/55 bg-background/78 backdrop-blur-2xl">
      <div className="mx-auto max-w-[1720px] px-4 sm:px-5 lg:px-8">
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
                <StockSurMark className="h-9 w-9" />
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{settings.app_name ?? currentCompany?.name}</p>
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
                  <Select
                    value={currentCompany?.id ?? undefined}
                    onValueChange={(companyId) => void handleCompanyChange(companyId)}
                    disabled={switchingCompany}
                  >
                    <SelectTrigger className="h-10 rounded-full border-border/55 bg-card/66 px-3.5 text-sm shadow-none hover:bg-accent/45">
                      <SelectValue placeholder={switchingCompany ? "Cambiando empresa..." : "Seleccionar empresa"} />
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

              {companies.length === 1 && currentCompany ? (
                <div className="max-w-[260px] truncate rounded-full border border-border/55 bg-card/66 px-3.5 py-2 text-sm font-medium text-foreground shadow-none">
                  {currentCompany.name}
                </div>
              ) : null}

              {companies.length === 0 ? (
                <div className="max-w-[260px] truncate rounded-full border border-destructive/25 bg-destructive/10 px-3.5 py-2 text-sm font-medium text-destructive">
                  Sin empresa activa
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

          <nav
            aria-label="Navegación principal"
            className="border-t border-border/40 pt-2"
          >
            <div className="flex min-w-0 items-center justify-start gap-1">
              {visibleNavItems.filter((item) => item.url === "/").map((item) => {
                const isActive =
                  location.pathname === item.url ||
                  (item.url !== "/" && location.pathname.startsWith(`${item.url}/`));

                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/35 hover:text-foreground",
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
              <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "min-h-10 min-w-0 justify-start gap-2 rounded-lg px-3 text-[13px] font-medium text-muted-foreground",
                      activeItem?.url !== "/" && "bg-accent/55 text-foreground",
                    )}
                    aria-label={`Abrir módulos${activeItem?.url !== "/" ? `. Módulo activo: ${activeItem?.title}` : ""}`}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    <span>Módulos</span>
                    {activeItem?.url !== "/" ? (
                      <span className="max-w-[45vw] truncate border-l border-border pl-2 text-xs text-muted-foreground sm:max-w-none">
                        {activeItem.title}
                      </span>
                    ) : null}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl rounded-xl p-5 sm:p-6">
                  <DialogHeader>
                    <DialogTitle>Módulos operativos</DialogTitle>
                    <DialogDescription>Accesos agrupados según la tarea que necesitás realizar.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {navGroups.map((group) => {
                      const items = visibleNavItems.filter((item) =>
                        (group.urls as readonly string[]).includes(item.url),
                      );
                      if (items.length === 0) return null;

                      return (
                        <section key={group.title} aria-labelledby={`nav-group-${group.title}`} className={cn("space-y-2", group.domainClassName)}>
                          <h3
                            id={`nav-group-${group.title}`}
                            className="flex items-center gap-2 border-b border-[hsl(var(--domain-accent))]/20 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground"
                          >
                            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[hsl(var(--domain-accent))]" />
                            {group.title}
                          </h3>
                          <div className="grid gap-1">
                            {items.map((item) => {
                              const isActive = isItemActive(item.url);
                              return (
                                <Link
                                  key={item.url}
                                  to={item.url}
                                  aria-current={isActive ? "page" : undefined}
                                  onClick={() => setModulesOpen(false)}
                                  className={cn(
                                    "flex min-h-10 items-center rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-[hsl(var(--domain-accent))]/15 hover:bg-[hsl(var(--domain-accent))]/[.07] hover:text-foreground",
                                    isActive && "domain-selection font-semibold text-foreground",
                                  )}
                                >
                                  {item.title}
                                </Link>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
