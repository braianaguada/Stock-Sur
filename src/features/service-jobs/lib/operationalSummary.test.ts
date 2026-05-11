import { describe, expect, it } from "vitest";
import { getServiceJobOperationalFields, getServiceJobOperationalStats } from "./operationalSummary";
import type { ServiceJobListItem, ServiceWithTechnicians } from "../types";

const job = (overrides: Partial<ServiceJobListItem>): ServiceJobListItem => ({
  id: "job-1",
  company_id: "company-1",
  customer_id: null,
  title: "Trabajo",
  description: null,
  status: "OPEN",
  priority: "NORMAL",
  opened_at: "2026-05-10T10:00:00Z",
  closed_at: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-05-10T10:00:00Z",
  updated_at: "2026-05-10T11:00:00Z",
  customers: null,
  serviceCount: 0,
  technicianNames: [],
  remitoCount: 0,
  materialLineCount: 0,
  materialTotal: 0,
  estimatedMaterialCost: 0,
  doneServiceCount: 0,
  pendingServiceCount: 0,
  lastActivityAt: null,
  ...overrides,
});

const service = (overrides: Partial<ServiceWithTechnicians>): ServiceWithTechnicians => ({
  id: "service-1",
  company_id: "company-1",
  job_id: "job-1",
  title: "Servicio",
  description: null,
  scheduled_at: null,
  status: "PENDING",
  tasks_performed: null,
  notes: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-05-10T10:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
  technicianIds: [],
  technicianNames: [],
  materialRemitos: [],
  ...overrides,
});

describe("service job operational summary", () => {
  it("counts jobs and services by status", () => {
    const jobs = [
      job({ id: "open", status: "OPEN" }),
      job({ id: "progress", status: "IN_PROGRESS" }),
      job({ id: "done", status: "DONE" }),
    ];
    const servicesByJobId = new Map([
      ["open", [service({ id: "pending", status: "PENDING", job_id: "open" })]],
      ["done", [service({ id: "done-service", status: "DONE", job_id: "done" })]],
    ]);

    expect(getServiceJobOperationalStats(jobs, servicesByJobId)).toMatchObject({
      openJobs: 1,
      inProgressJobs: 1,
      doneJobs: 1,
      pendingServices: 1,
      doneServices: 1,
    });
  });

  it("sums estimated material cost from linked remitos", () => {
    const fields = getServiceJobOperationalFields(job({}), [
      service({
        materialRemitos: [
          {
            id: "doc-1",
            service_id: "service-1",
            status: "ISSUED",
            point_of_sale: 1,
            document_number: 10,
            issue_date: "2026-05-10T13:00:00Z",
            customer_id: null,
            technician_id: null,
            customer_name: null,
            total: 500,
            created_at: "2026-05-10T13:00:00Z",
            lineCount: 2,
            estimatedCost: 320,
          },
        ],
      }),
    ]);

    expect(fields.remitoCount).toBe(1);
    expect(fields.materialLineCount).toBe(2);
    expect(fields.materialTotal).toBe(500);
    expect(fields.estimatedMaterialCost).toBe(320);
    expect(fields.lastActivityAt).toBe("2026-05-10T13:00:00Z");
  });
});
