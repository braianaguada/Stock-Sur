import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query-keys";
import { serviceDb } from "@/features/services/db";
import { buildServiceJobPayload, buildServicePayload, buildTechnicianAssignments } from "../lib/serviceJobForm";
import type {
  ServiceForm,
  ServiceJobCustomer,
  ServiceJobForm,
  ServiceJobListItem,
  ServiceJobRow,
  ServiceJobTechnician,
  ServiceRow,
  ServiceTechnicianAssignment,
  ServiceWithTechnicians,
} from "../types";

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

export function useServiceJobs(params: {
  companyId: string | null;
  userId: string | null | undefined;
  search: string;
  status: string;
  technicianId: string;
  from: string;
  to: string;
  toast: ToastFn;
}) {
  const { companyId, userId, search, status, technicianId, from, to, toast } = params;
  const qc = useQueryClient();
  const trimmedSearch = search.trim();

  const customersQuery = useQuery({
    queryKey: queryKeys.serviceJobs.customers(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("customers")
        .select("id, name, is_occasional")
        .eq("company_id", companyId)
        .eq("is_occasional", false)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ServiceJobCustomer[];
    },
  });

  const techniciansQuery = useQuery({
    queryKey: queryKeys.serviceJobs.technicians(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("technicians")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ServiceJobTechnician[];
    },
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.serviceJobs.list(companyId, trimmedSearch, status, technicianId, from, to),
    enabled: Boolean(companyId),
    queryFn: async () => {
      let query = serviceDb
        .from("service_jobs")
        .select("*, customers(id, name, is_occasional)")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });

      if (status !== "ALL") query = query.eq("status", status);
      if (from) query = query.gte("opened_at", `${from}T00:00:00`);
      if (to) query = query.lte("opened_at", `${to}T23:59:59`);

      const { data, error } = await query.limit(300);
      if (error) throw error;

      const jobs = (data ?? []) as ServiceJobRow[];
      const jobIds = jobs.map((job) => job.id);
      if (jobIds.length === 0) return { jobs: [], services: [], assignments: [] };

      const { data: servicesData, error: servicesError } = await serviceDb
        .from("service_job_services")
        .select("*")
        .eq("company_id", companyId)
        .in("job_id", jobIds)
        .order("scheduled_at", { ascending: false });
      if (servicesError) throw servicesError;

      const services = (servicesData ?? []) as ServiceRow[];
      const serviceIds = services.map((service) => service.id);
      if (serviceIds.length === 0) return { jobs, services, assignments: [] };

      const { data: assignmentsData, error: assignmentsError } = await serviceDb
        .from("service_job_service_technicians")
        .select("*, technicians(id, name)")
        .eq("company_id", companyId)
        .in("service_id", serviceIds);
      if (assignmentsError) throw assignmentsError;

      return { jobs, services, assignments: (assignmentsData ?? []) as ServiceTechnicianAssignment[] };
    },
  });

  const servicesByJobId = useMemo(() => {
    const assignmentsByService = new Map<string, ServiceTechnicianAssignment[]>();
    for (const assignment of jobsQuery.data?.assignments ?? []) {
      assignmentsByService.set(assignment.service_id, [...(assignmentsByService.get(assignment.service_id) ?? []), assignment]);
    }

    const map = new Map<string, ServiceWithTechnicians[]>();
    for (const service of jobsQuery.data?.services ?? []) {
      const assignments = assignmentsByService.get(service.id) ?? [];
      const enriched: ServiceWithTechnicians = {
        ...service,
        technicianIds: assignments.map((assignment) => assignment.technician_id),
        technicianNames: assignments.map((assignment) => assignment.technicians?.name ?? "Tecnico").sort(),
      };
      map.set(service.job_id, [...(map.get(service.job_id) ?? []), enriched]);
    }
    return map;
  }, [jobsQuery.data?.assignments, jobsQuery.data?.services]);

  const jobs = useMemo(() => {
    const lowerSearch = trimmedSearch.toLowerCase();
    return (jobsQuery.data?.jobs ?? [])
      .map<ServiceJobListItem>((job) => {
        const services = servicesByJobId.get(job.id) ?? [];
        const technicianNames = Array.from(new Set(services.flatMap((service) => service.technicianNames))).sort();
        return { ...job, serviceCount: services.length, technicianNames };
      })
      .filter((job) => {
        if (technicianId !== "ALL") {
          const services = servicesByJobId.get(job.id) ?? [];
          if (!services.some((service) => service.technicianIds.includes(technicianId))) return false;
        }
        if (!lowerSearch) return true;
        return job.title.toLowerCase().includes(lowerSearch) || (job.customers?.name ?? "").toLowerCase().includes(lowerSearch);
      });
  }, [jobsQuery.data?.jobs, servicesByJobId, technicianId, trimmedSearch]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.serviceJobs.all() });
  };

  const saveJobMutation = useMutation({
    mutationFn: async (payload: { form: ServiceJobForm; jobId?: string | null }) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de guardar trabajos");
      const body = buildServiceJobPayload(payload.form, companyId, userId);
      const query = payload.jobId
        ? serviceDb.from("service_jobs").update(body).eq("id", payload.jobId)
        : serviceDb.from("service_jobs").insert(body);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Trabajo guardado" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo guardar el trabajo", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await serviceDb.from("service_jobs").delete().eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Trabajo eliminado" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo eliminar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const saveServiceMutation = useMutation({
    mutationFn: async (payload: { form: ServiceForm; serviceId?: string | null; jobId: string }) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de guardar servicios");
      const body = buildServicePayload(payload.form, companyId, payload.jobId, userId);
      let serviceId = payload.serviceId ?? null;

      if (serviceId) {
        const { error } = await serviceDb.from("service_job_services").update(body).eq("id", serviceId);
        if (error) throw error;
      } else {
        const { data, error } = await serviceDb.from("service_job_services").insert(body).select("id").single();
        if (error) throw error;
        serviceId = (data as { id: string }).id;
      }

      const { error: deleteError } = await serviceDb.from("service_job_service_technicians").delete().eq("service_id", serviceId);
      if (deleteError) throw deleteError;

      const assignments = buildTechnicianAssignments(payload.form.technician_ids, companyId, serviceId, userId);
      if (assignments.length > 0) {
        const { error: insertError } = await serviceDb.from("service_job_service_technicians").insert(assignments);
        if (insertError) throw insertError;
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Servicio guardado" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo guardar el servicio", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await serviceDb.from("service_job_services").delete().eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Servicio eliminado" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo eliminar", description: getErrorMessage(error), variant: "destructive" }),
  });

  return {
    customers: customersQuery.data ?? [],
    technicians: techniciansQuery.data ?? [],
    jobs,
    servicesByJobId,
    isLoading: jobsQuery.isLoading,
    saveJobMutation,
    deleteJobMutation,
    saveServiceMutation,
    deleteServiceMutation,
  };
}
