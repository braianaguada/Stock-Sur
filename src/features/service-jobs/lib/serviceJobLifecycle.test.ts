import { describe, expect, it } from "vitest";
import {
  getServiceJobDeleteState,
  isServiceJobArchived,
  SERVICE_JOB_DELETE_WITH_DOCUMENTS_MESSAGE,
  SERVICE_JOB_DELETE_WITH_SERVICES_MESSAGE,
} from "./serviceJobLifecycle";
import type { ServiceJobListItem, ServiceWithTechnicians } from "../types";

const job = (overrides: Partial<ServiceJobListItem> = {}): ServiceJobListItem => ({
  id: "job-1",
  company_id: "company-1",
  customer_id: null,
  title: "Trabajo",
  description: null,
  status: "OPEN",
  priority: "NORMAL",
  opened_at: "2026-05-14T10:00:00Z",
  closed_at: null,
  archived_at: null,
  archived_by: null,
  created_by: null,
  created_at: "2026-05-14T10:00:00Z",
  updated_at: "2026-05-14T10:00:00Z",
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
  canDelete: true,
  deleteBlockedReason: null,
  hasLinkedDocuments: false,
  ...overrides,
});

const service = (overrides: Partial<ServiceWithTechnicians> = {}): ServiceWithTechnicians => ({
  id: "service-1",
  company_id: "company-1",
  job_id: "job-1",
  title: "Servicio",
  description: null,
  scheduled_at: null,
  started_at: null,
  finished_at: null,
  status: "PENDING",
  tasks_performed: null,
  notes: null,
  created_by: null,
  created_at: "2026-05-14T10:00:00Z",
  updated_at: "2026-05-14T10:00:00Z",
  technicianIds: [],
  technicianNames: [],
  materialRemitos: [],
  ...overrides,
});

describe("service job lifecycle helpers", () => {
  it("allows deleting a job without services", () => {
    expect(getServiceJobDeleteState([])).toEqual({
      canDelete: true,
      reason: null,
      hasServices: false,
      hasLinkedDocuments: false,
    });
  });

  it("blocks deleting a job with services", () => {
    expect(getServiceJobDeleteState([service()])).toMatchObject({
      canDelete: false,
      reason: SERVICE_JOB_DELETE_WITH_SERVICES_MESSAGE,
      hasServices: true,
      hasLinkedDocuments: false,
    });
  });

  it("blocks deleting a job with linked remitos/documents", () => {
    expect(
      getServiceJobDeleteState([
        service({
          materialRemitos: [
            {
              id: "doc-1",
              service_id: "service-1",
              status: "ISSUED",
              point_of_sale: 1,
              document_number: 1,
              issue_date: "2026-05-14T10:00:00Z",
              customer_id: null,
              technician_id: null,
              customer_name: null,
              total: 100,
              created_at: "2026-05-14T10:00:00Z",
              lineCount: 1,
              estimatedCost: 80,
            },
          ],
        }),
      ]),
    ).toMatchObject({
      canDelete: false,
      reason: SERVICE_JOB_DELETE_WITH_DOCUMENTS_MESSAGE,
      hasServices: true,
      hasLinkedDocuments: true,
    });
  });

  it("detects archived jobs", () => {
    expect(isServiceJobArchived(job())).toBe(false);
    expect(isServiceJobArchived(job({ archived_at: "2026-05-14T12:00:00Z" }))).toBe(true);
  });
});
