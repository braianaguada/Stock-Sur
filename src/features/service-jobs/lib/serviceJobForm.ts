import {
  SERVICE_JOB_PRIORITIES,
  SERVICE_JOB_STATUSES,
  SERVICE_STATUSES,
  type ServiceForm,
  type ServiceJobForm,
  type ServiceJobPriority,
  type ServiceJobStatus,
  type ServiceStatus,
} from "../types";

export const DEFAULT_JOB_FORM: ServiceJobForm = {
  title: "",
  customer_id: "",
  description: "",
  status: "OPEN",
  priority: "NORMAL",
};

export const DEFAULT_SERVICE_FORM: ServiceForm = {
  title: "",
  description: "",
  scheduled_at: "",
  status: "PENDING",
  technician_ids: [],
  tasks_performed: "",
  notes: "",
};

export function normalizeJobStatus(value: string): ServiceJobStatus {
  const normalized = value.trim().toUpperCase();
  return SERVICE_JOB_STATUSES.includes(normalized as ServiceJobStatus) ? (normalized as ServiceJobStatus) : "OPEN";
}

export function normalizeJobPriority(value: string | null | undefined): ServiceJobPriority {
  const normalized = (value ?? "NORMAL").trim().toUpperCase();
  return SERVICE_JOB_PRIORITIES.includes(normalized as ServiceJobPriority) ? (normalized as ServiceJobPriority) : "NORMAL";
}

function normalizeServiceStatus(value: string): ServiceStatus {
  const normalized = value.trim().toUpperCase();
  return SERVICE_STATUSES.includes(normalized as ServiceStatus) ? (normalized as ServiceStatus) : "PENDING";
}

function uniqueTechnicianIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function buildServiceJobPayload(form: ServiceJobForm, companyId: string, userId: string | null | undefined) {
  const title = form.title.trim();
  if (!title) throw new Error("El trabajo requiere titulo");

  return {
    company_id: companyId,
    customer_id: form.customer_id || null,
    title,
    description: form.description.trim() || null,
    status: normalizeJobStatus(form.status),
    priority: normalizeJobPriority(form.priority),
    created_by: userId ?? null,
  };
}

export function buildServicePayload(form: ServiceForm, companyId: string, jobId: string, userId: string | null | undefined) {
  const title = form.title.trim();
  if (!title) throw new Error("El servicio requiere titulo");

  return {
    company_id: companyId,
    job_id: jobId,
    title,
    description: form.description.trim() || null,
    scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    status: normalizeServiceStatus(form.status),
    tasks_performed: form.tasks_performed.trim() || null,
    notes: form.notes.trim() || null,
    created_by: userId ?? null,
  };
}

export function buildTechnicianAssignments(
  technicianIds: string[],
  companyId: string,
  serviceId: string,
  userId: string | null | undefined,
) {
  return uniqueTechnicianIds(technicianIds).map((technicianId) => ({
    company_id: companyId,
    service_id: serviceId,
    technician_id: technicianId,
    created_by: userId ?? null,
  }));
}
