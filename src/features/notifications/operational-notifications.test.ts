import { describe, expect, it } from "vitest";
import type { DashboardAction } from "@/features/index/dashboard-insights";
import { buildOperationalNotifications, countOperationalPendings } from "@/features/notifications/operational-notifications";

const actions: DashboardAction[] = [
  { key: "missing-cost", label: "Sin costo", count: 80, detail: "Ruido", href: "/price-lists", tone: "warning" },
  { key: "pending-receipts", label: "Comprobantes", count: 3, detail: "Caja", href: "/cash", tone: "warning" },
  { key: "open-jobs", label: "Trabajos", count: 2, detail: "Uno urgente", href: "/service-jobs", tone: "danger" },
  { key: "sent-quotes", label: "Presupuestos de servicio enviados", count: 4, detail: "Esperan respuesta", href: "/services/documents", tone: "info" },
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

    expect(result.map((action) => action.key)).toEqual(["open-jobs", "pending-receipts", "sent-quotes"]);
    expect(countOperationalPendings(result)).toBe(9);
  });

  it("sends service budget follow-up to the bell for users who can view documents", () => {
    const result = buildOperationalNotifications(actions, {
      roles: ["user"],
      companyRoleCodes: [],
      companyPermissionCodes: ["documents.view"],
    });

    expect(result).toEqual([expect.objectContaining({
      key: "sent-quotes",
      href: "/services/documents?status=SENT",
      count: 4,
    })]);
  });
});
