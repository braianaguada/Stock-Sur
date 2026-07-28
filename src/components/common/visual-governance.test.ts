import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

const retiredVisualSymbols = [
  "CompactBadge",
  "DataCard",
  "FilterBar",
  "MetricHeroCard",
  "OperationalTableShell",
  "SectionCard",
  "StatCard",
] as const;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("visual governance", () => {
  it("keeps domain badges behind the canonical visual system", () => {
    const sourceFiles = listSourceFiles(resolve(root, "src"));
    const governanceTest = "src/components/common/visual-governance.test.ts";
    const rawBadgeAllowlist = [
      "src/components/common/VisualSystem.tsx",
      // Temporary exception: billing settings belongs to the unfinished billing/configuration scope.
      "src/features/billing/components/BillingFiscalSettingsSection.tsx",
    ];
    const actualRawBadgeConsumers = sourceFiles
      .filter((file) => relative(root, file).replace(/\\/g, "/") !== governanceTest)
      .filter((file) => /from\s+["']@\/components\/ui\/badge["']/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replace(/\\/g, "/"))
      .sort();

    expect(actualRawBadgeConsumers).toEqual(rawBadgeAllowlist.sort());
  });

  it("prevents local visual variants on canonical badges", () => {
    const canonicalBadgeTag = /<(?:StatusBadge|HealthBadge|CategoryBadge|CountBadge|InfoBadge)\b[\s\S]*?>/g;
    const localVisualVariant =
      /\b(?:bg-|border-(?:amber|blue|emerald|green|info|primary|red|rose|sky|slate|success|violet|warning)|capitalize|h-\d|leading-|lowercase|min-h-|px-|py-|text-(?:\[[^\]]+\]|amber|blue|emerald|green|info|primary|red|rose|sky|slate|success|violet|warning|xs)|uppercase)/;
    const visualSystem = "src/components/common/VisualSystem.tsx";
    const violations = listSourceFiles(resolve(root, "src")).flatMap((file) => {
      const relativePath = relative(root, file).replace(/\\/g, "/");
      if (relativePath === visualSystem) return [];

      return [...readFileSync(file, "utf8").matchAll(canonicalBadgeTag)]
        .filter((match) => localVisualVariant.test(match[0]))
        .map((match) => `${relativePath}: ${match[0].replace(/\s+/g, " ")}`);
    });

    expect(violations, "canonical badges may only receive layout/behavior classes").toEqual([]);
  });

  it("keeps retired visual APIs at zero source consumers", () => {
    const sourceFiles = listSourceFiles(resolve(root, "src"));

    for (const symbol of retiredVisualSymbols) {
      const actualConsumers = sourceFiles
        .filter((file) => relative(root, file).replace(/\\/g, "/") !== "src/components/common/visual-governance.test.ts")
        .filter((file) => new RegExp(`\\b${symbol}\\b`).test(readFileSync(file, "utf8")))
        .map((file) => relative(root, file).replace(/\\/g, "/"))
        .sort();

      expect(actualConsumers, `${symbol} must remain retired`).toEqual([]);
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
    expect(deprecations).toContain("cero consumidores");
  });

  it("locks the final visual polish into canonical layout rules", () => {
    const dashboard = readFileSync(resolve(root, "src/features/index/components/DashboardHero.tsx"), "utf8");
    const dashboardChart = readFileSync(
      resolve(root, "src/features/index/components/DashboardHeroChart.tsx"),
      "utf8",
    );
    const editor = readFileSync(resolve(root, "src/features/documents/components/DocumentsEditorDialog.tsx"), "utf8");
    const documentTable = readFileSync(resolve(root, "src/features/documents/components/DocumentsDataTable.tsx"), "utf8");
    const styles = readFileSync(resolve(root, "src/index.css"), "utf8");

    expect(dashboard).toContain("minmax(420px,1fr)");
    expect(dashboard).toContain("<MetricGrid columns={3}>");
    expect(dashboard, "the dashboard shell must not eagerly load the chart library").not.toContain('from "recharts"');
    expect(dashboardChart, "the deferred chart owns the Recharts dependency").toContain('from "recharts"');
    expect(editor).toContain(">Opciones</Label>");
    expect(documentTable).toContain("<DialogActionGrid columns={2}>");
    expect(styles).toContain("md:flex-row md:flex-wrap md:items-end");
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
      "src/features/index/components/DashboardHeroChart.tsx",
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

  it("keeps commercial flow surfaces on canonical primitives", () => {
    const commercialFiles = [
      "src/pages/Documents.tsx",
      "src/pages/Cash.tsx",
      "src/pages/Billing.tsx",
      "src/pages/CustomerAccount.tsx",
      "src/features/documents/components/DocumentsDataTable.tsx",
      "src/features/documents/components/DocumentsPreviewDialog.tsx",
      "src/features/documents/components/RegisterDocumentInCashDialog.tsx",
      "src/features/cash/components/CashClosurePreviewDialog.tsx",
      "src/features/cash/components/CashClosureTab.tsx",
      "src/features/cash/components/CashDocumentPreviewDialog.tsx",
      "src/features/cash/components/CashExpensesTab.tsx",
      "src/features/cash/components/CashHistoryTab.tsx",
      "src/features/cash/components/CashSalesTab.tsx",
    ];

    for (const file of commercialFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} must not import deprecated visual primitives`).not.toMatch(
        /\b(?:CompactBadge|DataCard|FilterBar|StatCard|MetricHeroCard|OperationalTableShell|SectionCard)\b/,
      );
      expect(source, `${file} must not import raw badges`).not.toContain('from "@/components/ui/badge"');
    }

    const expenses = readFileSync(resolve(root, "src/features/cash/components/CashExpensesTab.tsx"), "utf8");
    const billing = readFileSync(resolve(root, "src/pages/Billing.tsx"), "utf8");
    expect(expenses, "cash expenses must use the canonical DataTable").not.toContain("<table");
    expect(billing, "billing documents must use the canonical DataTable").not.toContain("<table");
  });

  it("keeps service workflow surfaces on canonical primitives", () => {
    const serviceFiles = [
      "src/pages/ServiceJobs.tsx",
      "src/pages/ServiceDocuments.tsx",
      "src/pages/Technicians.tsx",
      "src/pages/Settlements.tsx",
    ];

    for (const file of serviceFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} must not import deprecated visual primitives`).not.toMatch(
        /\b(?:CompactBadge|DataCard|FilterBar|StatCard|MetricHeroCard|OperationalTableShell|SectionCard)\b/,
      );
      expect(source, `${file} must not import raw badges`).not.toContain('from "@/components/ui/badge"');
    }

    const serviceDocuments = readFileSync(resolve(root, "src/pages/ServiceDocuments.tsx"), "utf8");
    expect(serviceDocuments, "service document listing must use the canonical DataTable").toContain("<DataTable");
  });

  it("keeps administration surfaces on canonical primitives", () => {
    const administrationFiles = [
      "src/pages/Users.tsx",
      "src/pages/Settings.tsx",
      "src/features/users/components/UsersOverviewHeader.tsx",
      "src/features/users/components/UsersAccessTable.tsx",
      "src/features/users/components/CompaniesManagementCard.tsx",
      "src/features/users/components/UserAccessDialog.tsx",
      "src/features/users/components/UserDetailDialog.tsx",
    ];

    for (const file of administrationFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} must not import deprecated visual primitives`).not.toMatch(
        /\b(?:CompactBadge|DataCard|FilterBar|StatCard|MetricHeroCard|OperationalTableShell|SectionCard)\b/,
      );
      expect(source, `${file} must not import raw badges`).not.toContain('from "@/components/ui/badge"');
    }

    const usersTable = readFileSync(resolve(root, "src/features/users/components/UsersAccessTable.tsx"), "utf8");
    const companiesTable = readFileSync(resolve(root, "src/features/users/components/CompaniesManagementCard.tsx"), "utf8");
    const settings = readFileSync(resolve(root, "src/pages/Settings.tsx"), "utf8");
    expect(usersTable, "user administration must use the canonical DataTable").toContain("<DataTable");
    expect(companiesTable, "company administration must use the canonical DataTable").toContain("<DataTable");
    expect(settings, "settings columns must shrink without causing root overflow").toContain(
      'grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]',
    );
  });
});
