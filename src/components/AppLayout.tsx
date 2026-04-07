import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="app-shell min-h-screen w-full bg-transparent">
      <AppSidebar />
      <main className="overflow-auto">
        <div
          key={location.pathname}
          className="route-transition mx-auto max-w-[1480px] px-6 py-8 lg:px-10 lg:py-10"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
