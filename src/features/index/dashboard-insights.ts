export type DashboardActionTone = "default" | "info" | "warning" | "danger";

export type DashboardAction = {
  key: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: DashboardActionTone;
};

export type DashboardMonthlySale = {
  month: string;
  total: number;
  count: number;
};

export type DashboardCategoryPoint = {
  category: string;
  value: number;
};

export type DashboardTopItem = {
  itemId: string;
  name: string;
  sku: string | null;
  quantity: number;
  baseCost: number;
  stockValue: number;
};

export type DashboardInsights = {
  metrics: {
    inventoryValue: number;
    inventoryUnits: number;
    itemsWithStock: number;
    activeItems: number;
    itemsWithoutCost: number;
    valuedItemsShare: number;
    salesToday: number;
    salesTodayCount: number;
    salesMonth: number;
    accountsReceivable: number;
  };
  actions: DashboardAction[];
  monthlySales: DashboardMonthlySale[];
  categoryValues: DashboardCategoryPoint[];
  topItemsByValue: DashboardTopItem[];
};

export const EMPTY_DASHBOARD: DashboardInsights = {
  metrics: {
    inventoryValue: 0,
    inventoryUnits: 0,
    itemsWithStock: 0,
    activeItems: 0,
    itemsWithoutCost: 0,
    valuedItemsShare: 0,
    salesToday: 0,
    salesTodayCount: 0,
    salesMonth: 0,
    accountsReceivable: 0,
  },
  actions: [],
  monthlySales: [],
  categoryValues: [],
  topItemsByValue: [],
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeDashboardInsights(value: unknown): DashboardInsights {
  const source = recordValue(value);
  const metrics = recordValue(source.metrics);

  return {
    metrics: {
      inventoryValue: numberValue(metrics.inventoryValue),
      inventoryUnits: numberValue(metrics.inventoryUnits),
      itemsWithStock: numberValue(metrics.itemsWithStock),
      activeItems: numberValue(metrics.activeItems),
      itemsWithoutCost: numberValue(metrics.itemsWithoutCost),
      valuedItemsShare: numberValue(metrics.valuedItemsShare),
      salesToday: numberValue(metrics.salesToday),
      salesTodayCount: numberValue(metrics.salesTodayCount),
      salesMonth: numberValue(metrics.salesMonth),
      accountsReceivable: numberValue(metrics.accountsReceivable),
    },
    actions: arrayValue(source.actions).map((entry) => {
      const action = recordValue(entry);
      const tone = String(action.tone ?? "default");
      return {
        key: String(action.key ?? ""),
        label: String(action.label ?? ""),
        count: numberValue(action.count),
        detail: String(action.detail ?? ""),
        href: String(action.href ?? "/"),
        tone: tone === "info" || tone === "warning" || tone === "danger" ? tone : "default",
      };
    }),
    monthlySales: arrayValue(source.monthlySales).map((entry) => {
      const point = recordValue(entry);
      return {
        month: String(point.month ?? ""),
        total: numberValue(point.total),
        count: numberValue(point.count),
      };
    }),
    categoryValues: arrayValue(source.categoryValues).map((entry) => {
      const point = recordValue(entry);
      return {
        category: String(point.category ?? "Sin categoria"),
        value: numberValue(point.value),
      };
    }),
    topItemsByValue: arrayValue(source.topItemsByValue).map((entry) => {
      const item = recordValue(entry);
      return {
        itemId: String(item.itemId ?? ""),
        name: String(item.name ?? "Item"),
        sku: item.sku ? String(item.sku) : null,
        quantity: numberValue(item.quantity),
        baseCost: numberValue(item.baseCost),
        stockValue: numberValue(item.stockValue),
      };
    }),
  };
}
