import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { companies, currentCompany, loading, user } = useAuth();
  const hasNoActiveCompanyAccess = Boolean(user) && !loading && companies.length === 0 && !currentCompany;

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="app-shell min-h-screen w-full bg-transparent">
      <a
        href="#contenido-principal"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Saltar al contenido principal
      </a>
      <AppSidebar />
      <main id="contenido-principal" ref={mainRef} tabIndex={-1} className="min-w-0 outline-none lg:pl-24">
        <div
          key={location.pathname}
          className="route-transition mx-auto max-w-[var(--content-max)] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        >
          {hasNoActiveCompanyAccess ? (
            <section className="mx-auto max-w-2xl rounded-3xl border border-destructive/20 bg-card p-8 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-destructive">Empresa activa</p>
              <h1 className="mt-3 text-2xl font-semibold text-foreground">
                Tu usuario no tiene acceso a ninguna empresa activa.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Pedile a un administrador que revise tu membresia o active una empresa antes de operar.
              </p>
            </section>
          ) : children}
        </div>
      </main>
    </div>
  );
}
