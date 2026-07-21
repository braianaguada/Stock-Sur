import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

const deprecatedConsumers: Record<string, readonly string[]> = {
  CompactBadge: [
    "src/features/cash/components/CashClosurePreviewDialog.tsx",
    "src/features/cash/components/CashClosureTab.tsx",
    "src/features/cash/components/CashExpensesTab.tsx",
    "src/features/cash/components/CashHistoryTab.tsx",
    "src/features/cash/components/CashSalesTab.tsx",
    "src/pages/Billing.tsx",
    "src/pages/Combos.tsx",
    "src/pages/ServiceDocuments.tsx",
    "src/pages/ServiceJobs.tsx",
  ],
  MetricHeroCard: [
    "src/components/common/VisualSystem.test.tsx",
    "src/pages/Technicians.tsx",
  ],
  OperationalTableShell: [
    "src/components/common/VisualSystem.test.tsx",
    "src/features/cash/components/CashExpensesTab.tsx",
    "src/features/cash/components/CashSalesTab.tsx",
    "src/pages/Billing.tsx",
    "src/pages/ServiceDocuments.tsx",
    "src/pages/ServiceJobs.tsx",
    "src/pages/Technicians.tsx",
  ],
  SectionCard: ["src/pages/Billing.tsx", "src/pages/Combos.tsx", "src/pages/Technicians.tsx"],
};

const visualSystemImport =
  /import\s*\{([^}]+)\}\s*from\s*["'](?:@\/components\/common\/VisualSystem|\.\/VisualSystem)["']/g;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function importsDeprecatedSymbol(source: string, symbol: string): boolean {
  return [...source.matchAll(visualSystemImport)].some((match) =>
    match[1]
      .split(",")
      .map((name) => name.trim().split(/\s+as\s+/)[0])
      .includes(symbol),
  );
}

describe("visual governance", () => {
  it("does not expand the audited deprecated consumer baseline", () => {
    const sourceFiles = listSourceFiles(resolve(root, "src"));

    for (const [symbol, files] of Object.entries(deprecatedConsumers)) {
      const actualConsumers = sourceFiles
        .filter((file) => importsDeprecatedSymbol(readFileSync(file, "utf8"), symbol))
        .map((file) => relative(root, file).replace(/\\/g, "/"))
        .sort();

      expect(actualConsumers, `${symbol} consumers must match docs/deprecations.md`).toEqual([...files].sort());
    }
  });

  it("documents canonical ownership and deprecation policy", () => {
    const constitution = readFileSync(resolve(root, "docs/stock-sur-ui-constitution.md"), "utf8");
    const architecture = readFileSync(resolve(root, "docs/frontend-architecture.md"), "utf8");
    const catalog = readFileSync(resolve(root, "docs/component-catalog.md"), "utf8");
    const deprecations = readFileSync(resolve(root, "docs/deprecations.md"), "utf8");

    expect(constitution).toContain("### CANONICAL");
    expect(architecture).toContain("## Capas");
    expect(catalog).toContain("`PageContainer`");
    expect(catalog).toContain("`DataTable`");
    expect(deprecations).toContain("`MetricHeroCard`");
    expect(deprecations).toContain("allowlist");
  });

  it("keeps tabbed workspaces on canonical primitives", () => {
    const workspaceFiles = [
      "src/pages/Stock.tsx",
      "src/pages/PriceLists.tsx",
      "src/pages/CustomerAccount.tsx",
      "src/features/stock/components/StockCurrentTable.tsx",
      "src/features/stock/components/StockMovementsTable.tsx",
      "src/features/price-lists/components/BasePricesTable.tsx",
      "src/features/price-lists/components/PriceListProductsTable.tsx",
      "src/features/suppliers/components/SupplierCatalogDialog.tsx",
      "src/features/suppliers/components/SupplierCatalogLinesTable.tsx",
    ];

    for (const file of workspaceFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} must not import deprecated visual primitives`).not.toMatch(
        /\b(?:DataCard|FilterBar|StatCard|MetricHeroCard|OperationalTableShell)\b/,
      );
      expect(source, `${file} must not import raw badges`).not.toContain('from "@/components/ui/badge"');
    }
  });

  it("keeps analytical surfaces on canonical primitives", () => {
    const analyticalFiles = [
      "src/pages/Index.tsx",
      "src/pages/Cash.tsx",
      "src/pages/CashTotals.tsx",
      "src/pages/Settlements.tsx",
      "src/pages/Stock.tsx",
      "src/features/cash/components/CashSummaryCards.tsx",
      "src/features/index/components/DashboardHero.tsx",
      "src/features/index/components/DashboardHighlights.tsx",
      "src/features/index/components/OperationalAttention.tsx",
    ];

    for (const file of analyticalFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} must not import deprecated visual primitives`).not.toMatch(
        /\b(?:CompactBadge|DataCard|FilterBar|StatCard|MetricHeroCard|OperationalTableShell)\b/,
      );
      expect(source, `${file} must not import raw badges`).not.toContain('from "@/components/ui/badge"');
    }
  });

  it("keeps procurement surfaces on canonical primitives", () => {
    const procurementFiles = [
      "src/pages/Imports.tsx",
      "src/pages/LegacyCatalogImport.tsx",
      "src/pages/PurchaseOrders.tsx",
      "src/pages/Suppliers.tsx",
      "src/features/imports/components/ImportsPreviewTable.tsx",
      "src/features/imports/components/LegacyCatalogTable.tsx",
      "src/features/suppliers/components/PdfDocumentPreview.tsx",
      "src/features/suppliers/components/SupplierCatalogDialog.tsx",
      "src/features/suppliers/components/SupplierCatalogLinesTable.tsx",
      "src/features/suppliers/components/SupplierComparison.tsx",
    ];

    for (const file of procurementFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} must not import deprecated visual primitives`).not.toMatch(
        /\b(?:CompactBadge|DataCard|FilterBar|StatCard|MetricHeroCard|OperationalTableShell|SectionCard)\b/,
      );
      expect(source, `${file} must not import raw badges`).not.toContain('from "@/components/ui/badge"');
    }

    const purchaseOrders = readFileSync(resolve(root, "src/pages/PurchaseOrders.tsx"), "utf8");
    expect(purchaseOrders, "purchase order detail must use the canonical DataTable").not.toContain("<table");
  });
});
