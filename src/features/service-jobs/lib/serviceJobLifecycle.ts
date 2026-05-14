import type { ServiceJobListItem, ServiceWithTechnicians } from "../types";

export const SERVICE_JOB_DELETE_WITH_DOCUMENTS_MESSAGE =
  "Este trabajo tiene remitos/documentos vinculados y no puede eliminarse.";

export const SERVICE_JOB_DELETE_WITH_SERVICES_MESSAGE =
  "Este trabajo tiene servicios asociados. Para conservar trazabilidad, podes archivarlo en lugar de eliminarlo.";

export type ServiceJobDeleteState = {
  canDelete: boolean;
  reason: string | null;
  hasServices: boolean;
  hasLinkedDocuments: boolean;
};

export function getServiceJobDeleteState(services: ServiceWithTechnicians[]): ServiceJobDeleteState {
  const hasServices = services.length > 0;
  const hasLinkedDocuments = services.some((service) => service.materialRemitos.length > 0);

  if (hasLinkedDocuments) {
    return {
      canDelete: false,
      reason: SERVICE_JOB_DELETE_WITH_DOCUMENTS_MESSAGE,
      hasServices,
      hasLinkedDocuments,
    };
  }

  if (hasServices) {
    return {
      canDelete: false,
      reason: SERVICE_JOB_DELETE_WITH_SERVICES_MESSAGE,
      hasServices,
      hasLinkedDocuments,
    };
  }

  return {
    canDelete: true,
    reason: null,
    hasServices: false,
    hasLinkedDocuments: false,
  };
}

export function isServiceJobArchived(job: Pick<ServiceJobListItem, "archived_at">) {
  return Boolean(job.archived_at);
}
