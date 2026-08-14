import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceDb } from "@/features/services/db";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query-keys";
import { fetchAllPages, fetchAllPagesByChunks } from "@/lib/supabase-pagination";
import {
  buildDailyCards,
  selectLatestTechnicianStatusRows,
  type DailyServiceOption,
  type DailyTechnicianStatus,
  type TechnicianDailyCard,
  type TechnicianDailyStatusRow,
} from "../dailyBoard";
import type { Technician } from "../types";

type ToastFn = (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

type ServiceRecord = { id: string; job_id: string; title: string; status: string; scheduled_at: string | null };
type JobRecord = { id: string; title: string };
type AssignmentRecord = { service_id: string; technician_id: string };

export type DailyBoardUpdate = Pick<TechnicianDailyCard, "technician_id" | "status" | "service_id" | "activity" | "location" | "notes" | "position">;

export function getLocalBusinessDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useTechnicianDailyBoard({
  companyId,
  userId,
  businessDate,
  toast,
}: {
  companyId: string | null | undefined;
  userId: string | null | undefined;
  businessDate: string;
  toast: ToastFn;
}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.technicians.dailyBoard(companyId ?? null);

  const boardQuery = useQuery({
    queryKey,
    enabled: Boolean(companyId && businessDate),
    queryFn: async () => {
      const [technicianRows, statusRows, serviceRows] = await Promise.all([
        fetchAllPages(() => serviceDb.from("technicians").select("*").eq("company_id", companyId).eq("is_active", true).order("name").order("id")),
        fetchAllPages(() => serviceDb.from("technician_daily_statuses").select("*").eq("company_id", companyId).lte("business_date", businessDate).order("business_date", { ascending: false }).order("updated_at", { ascending: false })),
        fetchAllPages(() => serviceDb.from("service_job_services").select("id, job_id, title, status, scheduled_at").eq("company_id", companyId).in("status", ["PENDING", "IN_PROGRESS"]).order("scheduled_at").order("id")),
      ]);

      const services = serviceRows as ServiceRecord[];
      const jobIds = [...new Set(services.map((service) => service.job_id))];
      const serviceIds = services.map((service) => service.id);
      const [jobRows, assignmentRows] = await Promise.all([
        jobIds.length > 0
          ? fetchAllPagesByChunks(jobIds, (ids) => serviceDb.from("service_jobs").select("id, title").eq("company_id", companyId).in("id", ids).order("id"))
          : Promise.resolve([]),
        serviceIds.length > 0
          ? fetchAllPagesByChunks(serviceIds, (ids) => serviceDb.from("service_job_service_technicians").select("service_id, technician_id").eq("company_id", companyId).in("service_id", ids).order("id"))
          : Promise.resolve([]),
      ]);
      const jobsById = new Map((jobRows as JobRecord[]).map((job) => [job.id, job]));
      const technicianIdsByService = new Map<string, string[]>();
      for (const assignment of assignmentRows as AssignmentRecord[]) {
        const ids = technicianIdsByService.get(assignment.service_id) ?? [];
        ids.push(assignment.technician_id);
        technicianIdsByService.set(assignment.service_id, ids);
      }
      const serviceOptions: DailyServiceOption[] = services.map((service) => ({
        id: service.id,
        title: service.title,
        jobTitle: jobsById.get(service.job_id)?.title ?? "Trabajo",
        technicianIds: technicianIdsByService.get(service.id) ?? [],
        suggestedForDay: service.status === "IN_PROGRESS" || service.scheduled_at?.slice(0, 10) === businessDate,
      }));

      return {
        technicians: technicianRows as Technician[],
        rows: selectLatestTechnicianStatusRows(statusRows as TechnicianDailyStatusRow[]),
        services: serviceOptions,
      };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (update: DailyBoardUpdate) => {
      if (!companyId) throw new Error("Necesitas una empresa activa para actualizar el tablero.");
      const payload = {
        company_id: companyId,
        technician_id: update.technician_id,
        business_date: businessDate,
        status: update.status,
        service_id: update.service_id,
        activity: update.activity || null,
        location: update.location || null,
        notes: update.notes || null,
        position: update.position,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      };
      const { data, error } = await serviceDb
        .from("technician_daily_statuses")
        .upsert(payload, { onConflict: "company_id,technician_id,business_date" })
        .select("*")
        .single();
      if (error) throw error;
      return data as TechnicianDailyStatusRow;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<{
        technicians: Technician[];
        rows: TechnicianDailyStatusRow[];
        services: DailyServiceOption[];
      }>(queryKey, (current) => current ? {
        ...current,
        rows: [...current.rows.filter((row) => row.technician_id !== saved.technician_id), saved],
      } : current);
    },
    onError: (error) => toast({
      title: "No se pudo actualizar el tablero",
      description: getErrorMessage(error),
      variant: "destructive",
    }),
  });

  const data = boardQuery.data;
  const cards = data && companyId
    ? buildDailyCards(data.technicians, data.rows, data.services, companyId, businessDate)
    : [];

  const moveTechnician = (card: TechnicianDailyCard, status: DailyTechnicianStatus, position = 0) => {
    updateMutation.mutate({
      technician_id: card.technician_id,
      status,
      service_id: card.service_id,
      activity: card.activity,
      location: card.location,
      notes: card.notes,
      position,
    });
  };

  return {
    cards,
    services: data?.services ?? [],
    isLoading: boardQuery.isLoading,
    isUpdating: updateMutation.isPending,
    updateTechnician: (update: DailyBoardUpdate, onSuccess?: () => void) => updateMutation.mutate(update, { onSuccess }),
    moveTechnician,
  };
}
