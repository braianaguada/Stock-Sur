import { describe, expect, it } from "vitest";
import { buildDailyCards, selectLatestTechnicianStatusRows, type DailyServiceOption, type TechnicianDailyStatusRow } from "./dailyBoard";
import type { Technician } from "./types";

const technicians = [
  { id: "tech-1", name: "Ana", is_active: true },
  { id: "tech-2", name: "Luis", is_active: true },
] as Technician[];

const services: DailyServiceOption[] = [
  { id: "service-1", title: "Revision", jobTitle: "Equipo central", technicianIds: ["tech-1"], suggestedForDay: true },
];

describe("buildDailyCards", () => {
  it("suggests real assigned work for technicians without a saved daily state", () => {
    const cards = buildDailyCards(technicians, [], services, "company-1", "2026-08-13");
    expect(cards[0]).toMatchObject({ status: "ASSIGNED", service_id: "service-1", persisted: false });
    expect(cards[1]).toMatchObject({ status: "AVAILABLE", service_id: null, persisted: false });
  });

  it("keeps the explicit daily state above service suggestions", () => {
    const rows = [{
      id: "daily-1", company_id: "company-1", technician_id: "tech-1", business_date: "2026-08-13",
      status: "PAUSED", service_id: null, activity: "Esperando repuesto", location: null, notes: null,
      position: 2, created_by: null, updated_by: null, created_at: "now", updated_at: "now",
    }] as TechnicianDailyStatusRow[];
    const [card] = buildDailyCards(technicians, rows, services, "company-1", "2026-08-13");
    expect(card).toMatchObject({ status: "PAUSED", service_id: null, activity: "Esperando repuesto", persisted: true });
  });
});

describe("selectLatestTechnicianStatusRows", () => {
  it("keeps the latest saved state across business days", () => {
    const rows = [
      { technician_id: "tech-1", business_date: "2026-08-14", updated_at: "2026-08-14T09:00:00Z", status: "WORKING" },
      { technician_id: "tech-1", business_date: "2026-08-13", updated_at: "2026-08-13T18:00:00Z", status: "DONE" },
    ] as TechnicianDailyStatusRow[];
    expect(selectLatestTechnicianStatusRows(rows)).toHaveLength(1);
    expect(selectLatestTechnicianStatusRows(rows)[0].status).toBe("WORKING");
  });
});
