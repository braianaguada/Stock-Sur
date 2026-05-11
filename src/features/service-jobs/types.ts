export const SERVICE_JOB_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "DONE", "CANCELLED"] as const;
export const SERVICE_JOB_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const SERVICE_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export type ServiceJobStatus = (typeof SERVICE_JOB_STATUSES)[number];
export type ServiceJobPriority = (typeof SERVICE_JOB_PRIORITIES)[number];
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type ServiceJobForm = {
  title: string;
  customer_id: string;
  description: string;
  status: ServiceJobStatus;
  priority: ServiceJobPriority;
};

export type ServiceForm = {
  title: string;
  description: string;
  scheduled_at: string;
  status: ServiceStatus;
  technician_ids: string[];
  tasks_performed: string;
  notes: string;
};

export type ServiceJobCustomer = {
  id: string;
  name: string;
  cuit?: string | null;
  is_occasional?: boolean | null;
};

export type ServiceJobTechnician = {
  id: string;
  name: string;
};

export type ServiceJobRow = {
  id: string;
  company_id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: ServiceJobStatus;
  priority: ServiceJobPriority | null;
  opened_at: string;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: ServiceJobCustomer | null;
};

export type ServiceRow = {
  id: string;
  company_id: string;
  job_id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: ServiceStatus;
  tasks_performed: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceTechnicianAssignment = {
  id: string;
  company_id: string;
  service_id: string;
  technician_id: string;
  assigned_at: string;
  created_by: string | null;
  technicians?: ServiceJobTechnician | null;
};

export type ServiceJobListItem = ServiceJobRow & {
  serviceCount: number;
  technicianNames: string[];
};

export type ServiceWithTechnicians = ServiceRow & {
  technicianIds: string[];
  technicianNames: string[];
  materialRemitos: ServiceMaterialRemito[];
};

export type ServiceMaterialRemito = {
  id: string;
  service_id: string | null;
  status: string;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_id: string | null;
  technician_id: string | null;
  customer_name: string | null;
  total: number;
  created_at: string;
  lineCount: number;
  estimatedCost: number;
};

export type LinkableMaterialRemito = ServiceMaterialRemito & {
  service_id: string | null;
};
