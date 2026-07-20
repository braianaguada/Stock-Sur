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
    "src/features/cash/components/CashSummaryCards.tsx",
    "src/pages/Billing.tsx",
    "src/pages/Combos.tsx",
    "src/pages/ServiceDocuments.tsx",
    "src/pages/ServiceJobs.tsx",
  ],
  MetricHeroCard: [
    "src/components/common/VisualSystem.test.tsx",
    "src/pages/CashTotals.tsx",
    "src/pages/CustomerAccount.tsx",
    "src/pages/Technicians.tsx",
  ],
  OperationalTableShell: [
    "src/components/common/VisualSystem.test.tsx",
    "src/features/cash/components/CashExpensesTab.tsx",
    "src/features/cash/components/CashSalesTab.tsx",
    "src/pages/Billing.tsx",
    "src/pages/CashTotals.tsx",
    "src/pages/CustomerAccount.tsx",
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
});
