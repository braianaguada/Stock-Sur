export const appNavGroups = [
  { id: "commercial", title: "Comercial", domainClassName: "domain-commercial" },
  { id: "inventory", title: "Inventario", domainClassName: "domain-inventory" },
  { id: "purchases", title: "Compras", domainClassName: "domain-purchases" },
  { id: "services", title: "Servicios", domainClassName: "domain-services" },
  { id: "cash", title: "Finanzas", domainClassName: "domain-cash" },
  { id: "admin", title: "Administración", domainClassName: "domain-admin" },
] as const;

type AppNavGroupId = (typeof appNavGroups)[number]["id"];

type AppNavItem = {
  title: string;
  url: string;
  group: AppNavGroupId | null;
  requiresSettlements?: true;
  requiresBilling?: true;
  requiresSuperadmin?: true;
  requiresAdmin?: true;
};

export const appNavItems = [
  { title: "Dashboard", url: "/", group: null },
  { title: "Items", url: "/items", group: "inventory" },
  { title: "Combos", url: "/combos", group: "inventory" },
  { title: "Stock", url: "/stock", group: "inventory" },
  { title: "Proveedores", url: "/suppliers", group: "purchases" },
  { title: "Ordenes de compra", url: "/purchase-orders", group: "purchases" },
  { title: "Precios", url: "/price-lists", group: "inventory" },
  { title: "Documentos", url: "/documents", group: "commercial" },
  { title: "Servicios", url: "/services/documents", group: "services" },
  { title: "Trabajos", url: "/service-jobs", group: "services" },
  { title: "Tecnicos", url: "/technicians", group: "services" },
  { title: "Totales", url: "/cash-totals", group: "cash" },
  { title: "Caja", url: "/cash", group: "cash" },
  { title: "Rendiciones", url: "/settlements", group: "cash", requiresSettlements: true },
  { title: "Facturacion", url: "/billing", group: "commercial", requiresBilling: true },
  { title: "Clientes", url: "/customers", group: "commercial" },
  { title: "Estado de cuenta", url: "/customer-account", group: "commercial" },
  { title: "Usuarios", url: "/users", group: "admin", requiresSuperadmin: true },
  { title: "Configuración", url: "/settings", group: "admin", requiresAdmin: true },
] as const satisfies readonly AppNavItem[];
