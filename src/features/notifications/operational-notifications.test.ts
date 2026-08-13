import { describe, expect, it } from "vitest";
import type { DashboardAction } from "@/features/index/dashboard-insights";
import { buildOperationalNotifications, countOperationalPendings } from "@/features/notifications/operational-notifications";

const actions: DashboardAction[] = [
  { key: "missing-cost", label: "Sin costo", count: 80, detail: "Ruido", href: "/price-lists", tone: "warning" },
  { key: "pending-receipts", label: "Comprobantes", count: 3, detail: "Caja", href: "/cash", tone: "warning" },
  { key: "open-jobs", label: "Trabajos", count: 2, detail: "Uno urgente", href: "/service-jobs", tone: "danger" },
  { key: "draft-documents", label: "Borradores", count: 0, detail: "Documentos", href: "/documents", tone: "default" },
];

describe("operational notifications", () => {
  it("keeps only actionable positive alerts allowed by effective company permissions", () => {
    const result = buildOperationalNotifications(actions, {
      roles: ["user"],
      companyRoleCodes: [],
      companyPermissionCodes: ["cash.view"],
    });

    expect(result.map((action) => action.key)).toEqual(["pending-receipts"]);
  });

  it("lets administrators see relevant alerts and orders urgency first", () => {
    const result = buildOperationalNotifications(actions, {
      roles: ["admin"],
      companyRoleCodes: [],
      companyPermissionCodes: [],
    });

    expect(result.map((action) => action.key)).toEqual(["open-jobs", "pending-receipts"]);
    expect(countOperationalPendings(result)).toBe(5);
  });
});
