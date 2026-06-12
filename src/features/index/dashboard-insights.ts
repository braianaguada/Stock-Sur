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

export type DashboardMonthlyCash = {
  month: string;
  sales: number;
  expenses: number;
  net: number;
  count: number;
};

export type DashboardPaymentMethod = {
  method: string;
  total: number;
  count: number;
};

export type DashboardStockActivity = {
  itemId: string;
  name: string;
  quantity: number;
  stockValue: number;
  lastOutAt: string | null;
  out30: number;
  currentStock: number;
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
    expensesMonth: number;
    cashNetMonth: number;
    averageTicket: number;
    salesGrowthPct: number;
    slowStockValue: number;
    slowStockItems: number;
  };
  actions: DashboardAction[];
  monthlySales: DashboardMonthlySale[];
  categoryValues: DashboardCategoryPoint[];
  topItemsByValue: DashboardTopItem[];
  monthlyCash: DashboardMonthlyCash[];
  paymentMethods: DashboardPaymentMethod[];
  slowStock: DashboardStockActivity[];
  stockVelocity: DashboardStockActivity[];
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
    expensesMonth: 0,
    cashNetMonth: 0,
    averageTicket: 0,
    salesGrowthPct: 0,
    slowStockValue: 0,
    slowStockItems: 0,
  },
  actions: [],
  monthlySales: [],
  categoryValues: [],
  topItemsByValue: [],
  monthlyCash: [],
  paymentMethods: [],
  slowStock: [],
  stockVelocity: [],
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
      expensesMonth: numberValue(metrics.expensesMonth),
      cashNetMonth: numberValue(metrics.cashNetMonth),
      averageTicket: numberValue(metrics.averageTicket),
      salesGrowthPct: numberValue(metrics.salesGrowthPct),
      slowStockValue: numberValue(metrics.slowStockValue),
      slowStockItems: numberValue(metrics.slowStockItems),
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
    monthlyCash: arrayValue(source.monthlyCash).map((entry) => {
      const point = recordValue(entry);
      return {
        month: String(point.month ?? ""),
        sales: numberValue(point.sales),
        expenses: numberValue(point.expenses),
        net: numberValue(point.net),
        count: numberValue(point.count),
      };
    }),
    paymentMethods: arrayValue(source.paymentMethods).map((entry) => {
      const point = recordValue(entry);
      return {
        method: String(point.method ?? ""),
        total: numberValue(point.total),
        count: numberValue(point.count),
      };
    }),
    slowStock: arrayValue(source.slowStock).map(normalizeStockActivity),
    stockVelocity: arrayValue(source.stockVelocity).map(normalizeStockActivity),
  };
}

function normalizeStockActivity(entry: unknown): DashboardStockActivity {
  const item = recordValue(entry);
  return {
    itemId: String(item.itemId ?? ""),
    name: String(item.name ?? "Item"),
    quantity: numberValue(item.quantity),
    stockValue: numberValue(item.stockValue),
    lastOutAt: item.lastOutAt ? String(item.lastOutAt) : null,
    out30: numberValue(item.out30),
    currentStock: numberValue(item.currentStock),
  };
}

export function mergeDashboardInsights(base: DashboardInsights, businessValue: unknown): DashboardInsights {
  const business = normalizeDashboardInsights(businessValue);
  return {
    ...base,
    metrics: {
      ...base.metrics,
      expensesMonth: business.metrics.expensesMonth,
      cashNetMonth: business.metrics.cashNetMonth,
      averageTicket: business.metrics.averageTicket,
      salesGrowthPct: business.metrics.salesGrowthPct,
      slowStockValue: business.metrics.slowStockValue,
      slowStockItems: business.metrics.slowStockItems,
    },
    monthlyCash: business.monthlyCash,
    paymentMethods: business.paymentMethods,
    slowStock: business.slowStock,
    stockVelocity: business.stockVelocity,
  };
}
