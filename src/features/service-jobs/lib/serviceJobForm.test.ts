import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVICE_FORM,
  buildServiceJobPayload,
  buildServicePayload,
  buildTechnicianAssignments,
  normalizeJobPriority,
  normalizeJobStatus,
} from "./serviceJobForm";

describe("service job form helpers", () => {
  it("creates a valid job payload", () => {
    expect(buildServiceJobPayload({
      title: "  Instalacion camara  ",
      customer_id: "customer-1",
      description: "Alta inicial",
      status: "OPEN",
      priority: "HIGH",
    }, "company-1", "user-1")).toMatchObject({
      company_id: "company-1",
      customer_id: "customer-1",
      title: "Instalacion camara",
      status: "OPEN",
      priority: "HIGH",
      created_by: "user-1",
    });
  });

  it("blocks a job without title", () => {
    expect(() => buildServiceJobPayload({
      title: " ",
      customer_id: "",
      description: "",
      status: "OPEN",
      priority: "NORMAL",
    }, "company-1", "user-1")).toThrow("titulo");
  });

  it("creates service assignments without duplicate technicians", () => {
    expect(buildTechnicianAssignments(["tech-1", "tech-1", "tech-2"], "company-1", "service-1", "user-1")).toEqual([
      { company_id: "company-1", service_id: "service-1", technician_id: "tech-1", created_by: "user-1" },
      { company_id: "company-1", service_id: "service-1", technician_id: "tech-2", created_by: "user-1" },
    ]);
  });

  it("creates a service with technicians", () => {
    const payload = buildServicePayload({
      ...DEFAULT_SERVICE_FORM,
      title: "Revision",
      scheduled_at: "2026-05-09T10:30",
      technician_ids: ["tech-1"],
    }, "company-1", "job-1", "user-1");

    expect(payload).toMatchObject({
      company_id: "company-1",
      job_id: "job-1",
      title: "Revision",
      status: "PENDING",
    });
    expect(payload.scheduled_at).toContain("2026-05-09");
  });

  it("normalizes invalid status and priority to safe defaults", () => {
    expect(normalizeJobStatus("cerrado")).toBe("OPEN");
    expect(normalizeJobPriority("critica")).toBe("NORMAL");
  });
});
