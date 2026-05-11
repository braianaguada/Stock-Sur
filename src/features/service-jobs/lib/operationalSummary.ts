import { summarizeServiceRemitos } from "./serviceRemitos";
import type { ServiceJobListItem, ServiceWithTechnicians } from "../types";

export type ServiceJobOperationalFields = {
  remitoCount: number;
  materialLineCount: number;
  materialTotal: number;
  estimatedMaterialCost: number;
  doneServiceCount: number;
  pendingServiceCount: number;
  lastActivityAt: string | null;
};

export type ServiceJobOperationalStats = {
  openJobs: number;
  inProgressJobs: number;
  doneJobs: number;
  pendingServices: number;
  doneServices: number;
  estimatedMaterialCost: number;
};

function maxDateIso(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => {
      if (!value) return null;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? null : { value, time };
    })
    .filter((value): value is { value: string; time: number } => Boolean(value));

  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, current) => (current.time > latest.time ? current : latest)).value;
}

export function getServiceJobOperationalFields(
  job: Pick<ServiceJobListItem, "updated_at">,
  services: ServiceWithTechnicians[],
): ServiceJobOperationalFields {
  const allRemitos = services.flatMap((service) => service.materialRemitos);
  const remitoSummary = summarizeServiceRemitos(allRemitos);

  return {
    remitoCount: remitoSummary.documents,
    materialLineCount: remitoSummary.lineCount,
    materialTotal: remitoSummary.total,
    estimatedMaterialCost: remitoSummary.estimatedCost,
    doneServiceCount: services.filter((service) => service.status === "DONE").length,
    pendingServiceCount: services.filter((service) => service.status === "PENDING").length,
    lastActivityAt: maxDateIso([
      job.updated_at,
      ...services.map((service) => service.updated_at),
      ...allRemitos.flatMap((remito) => [remito.created_at, remito.issue_date]),
    ]),
  };
}

export function getServiceJobOperationalStats(
  jobs: ServiceJobListItem[],
  servicesByJobId: Map<string, ServiceWithTechnicians[]>,
): ServiceJobOperationalStats {
  return jobs.reduce<ServiceJobOperationalStats>(
    (stats, job) => {
      const services = servicesByJobId.get(job.id) ?? [];
      const fields = getServiceJobOperationalFields(job, services);
      return {
        openJobs: stats.openJobs + (job.status === "OPEN" ? 1 : 0),
        inProgressJobs: stats.inProgressJobs + (job.status === "IN_PROGRESS" ? 1 : 0),
        doneJobs: stats.doneJobs + (job.status === "DONE" ? 1 : 0),
        pendingServices: stats.pendingServices + fields.pendingServiceCount,
        doneServices: stats.doneServices + fields.doneServiceCount,
        estimatedMaterialCost: stats.estimatedMaterialCost + fields.estimatedMaterialCost,
      };
    },
    {
      openJobs: 0,
      inProgressJobs: 0,
      doneJobs: 0,
      pendingServices: 0,
      doneServices: 0,
      estimatedMaterialCost: 0,
    },
  );
}
