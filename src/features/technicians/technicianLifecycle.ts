export const TECHNICIAN_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar este tecnico porque tiene remitos, servicios o trabajos vinculados. Podes marcarlo como Inactivo para conservar el historial.";

export type TechnicianHistoryCounts = {
  documents: number;
  serviceAssignments: number;
};

export function hasTechnicianHistory(counts: TechnicianHistoryCounts) {
  return counts.documents > 0 || counts.serviceAssignments > 0;
}
