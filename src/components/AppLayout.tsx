import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { useCompanyBrand } from "@/contexts/company-brand-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const { settings } = useCompanyBrand();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="border-b bg-[hsl(var(--accent))]/60 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-primary/80 uppercase">{settings.app_name}</p>
              <p className="text-xs text-muted-foreground">Sistema interno de gestion comercial y stock</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: settings.primary_color }} />
              <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: settings.secondary_color }} />
              <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: settings.accent_color }} />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-6 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
