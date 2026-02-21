import { AppLayout } from "@/components/AppLayout";
import { Construction } from "lucide-react";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md">{description}</p>
      </div>
    </AppLayout>
  );
}

export function StockPage() {
  return <PlaceholderPage title="Stock" description="Gestión de movimientos y stock actual. Próximamente." />;
}

export function SuppliersPage() {
  return <PlaceholderPage title="Proveedores" description="CRUD de proveedores. Próximamente." />;
}

export function PriceListsPage() {
  return <PlaceholderPage title="Listas de precios" description="Gestión de listas de precios versionadas. Próximamente." />;
}

export function ImportsPage() {
  return <PlaceholderPage title="Importaciones" description="Importar Excel/CSV con mapeo de columnas. Próximamente." />;
}

export function PendingPage() {
  return <PlaceholderPage title="Pendientes" description="Revisión de ítems pendientes de matching. Próximamente." />;
}

export function QuotesPage() {
  return <PlaceholderPage title="Presupuestos" description="Crear y exportar presupuestos en PDF. Próximamente." />;
}

export function CustomersPage() {
  return <PlaceholderPage title="Clientes" description="Gestión de clientes. Próximamente." />;
}
