import type { Technician } from "./types";

export const DAILY_TECHNICIAN_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "TRAVELLING",
  "WORKING",
  "PAUSED",
  "DONE",
  "ABSENT",
] as const;

export type DailyTechnicianStatus = (typeof DAILY_TECHNICIAN_STATUSES)[number];

export const DAILY_STATUS_CONFIG: Record<DailyTechnicianStatus, { label: string; tone: string }> = {
  AVAILABLE: { label: "Disponible", tone: "border-slate-300 bg-slate-50/60 dark:bg-slate-950/20" },
  ASSIGNED: { label: "Asignado", tone: "border-blue-300 bg-blue-50/60 dark:bg-blue-950/20" },
  TRAVELLING: { label: "En camino", tone: "border-violet-300 bg-violet-50/60 dark:bg-violet-950/20" },
  WORKING: { label: "Trabajando", tone: "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" },
  PAUSED: { label: "Pausado", tone: "border-orange-300 bg-orange-50/60 dark:bg-orange-950/20" },
  DONE: { label: "Finalizado", tone: "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20" },
  ABSENT: { label: "Ausente", tone: "border-rose-300 bg-rose-50/60 dark:bg-rose-950/20" },
};

export type TechnicianDailyStatusRow = {
  id: string;
  company_id: string;
  technician_id: string;
  business_date: string;
  status: DailyTechnicianStatus;
  service_id: string | null;
  activity: string | null;
  location: string | null;
  notes: string | null;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyServiceOption = {
  id: string;
  title: string;
  jobTitle: string;
  technicianIds: string[];
  suggestedForDay: boolean;
};

export type TechnicianDailyCard = TechnicianDailyStatusRow & {
  technician: Technician;
  service: DailyServiceOption | null;
  persisted: boolean;
};

export function selectLatestTechnicianStatusRows(rows: TechnicianDailyStatusRow[]) {
  const latestByTechnician = new Map<string, TechnicianDailyStatusRow>();
  for (const row of rows) {
    if (!latestByTechnician.has(row.technician_id)) latestByTechnician.set(row.technician_id, row);
  }
  return Array.from(latestByTechnician.values());
}

export function buildDailyCards(
  technicians: Technician[],
  rows: TechnicianDailyStatusRow[],
  services: DailyServiceOption[],
  companyId: string,
  businessDate: string,
): TechnicianDailyCard[] {
  const rowByTechnician = new Map(rows.map((row) => [row.technician_id, row]));
  const serviceById = new Map(services.map((service) => [service.id, service]));

  return technicians.map((technician) => {
    const row = rowByTechnician.get(technician.id);
    const fallbackService = services.find((service) => service.suggestedForDay && service.technicianIds.includes(technician.id)) ?? null;
    const base: TechnicianDailyStatusRow = row ?? {
      id: `new-${technician.id}`,
      company_id: companyId,
      technician_id: technician.id,
      business_date: businessDate,
      status: fallbackService ? "ASSIGNED" : "AVAILABLE",
      service_id: fallbackService?.id ?? null,
      activity: null,
      location: null,
      notes: null,
      position: 0,
      created_by: null,
      updated_by: null,
      created_at: "",
      updated_at: "",
    };

    return {
      ...base,
      technician,
      service: base.service_id ? serviceById.get(base.service_id) ?? null : null,
      persisted: Boolean(row),
    };
  });
}
