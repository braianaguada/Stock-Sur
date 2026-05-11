import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query-keys";
import { serviceDb } from "@/features/services/db";
import { buildServiceRemitoDraftPayload } from "../lib/serviceRemitos";
import { buildServiceJobPayload, buildServicePayload, buildTechnicianAssignments } from "../lib/serviceJobForm";
import type {
  LinkableMaterialRemito,
  ServiceForm,
  ServiceJobCustomer,
  ServiceJobForm,
  ServiceJobListItem,
  ServiceJobRow,
  ServiceJobTechnician,
  ServiceRow,
  ServiceTechnicianAssignment,
  ServiceWithTechnicians,
  ServiceMaterialRemito,
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
        .select("id, name, cuit, is_occasional")
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
      if (jobIds.length === 0) return { jobs: [], services: [], assignments: [], remitos: [] };

      const { data: servicesData, error: servicesError } = await serviceDb
        .from("service_job_services")
        .select("*")
        .eq("company_id", companyId)
        .in("job_id", jobIds)
        .order("scheduled_at", { ascending: false });
      if (servicesError) throw servicesError;

      const services = (servicesData ?? []) as ServiceRow[];
      const serviceIds = services.map((service) => service.id);
      if (serviceIds.length === 0) return { jobs, services, assignments: [], remitos: [] };

      const [assignmentsResult, remitosResult] = await Promise.all([
        serviceDb
          .from("service_job_service_technicians")
          .select("*, technicians(id, name)")
          .eq("company_id", companyId)
          .in("service_id", serviceIds),
        serviceDb
          .from("documents")
          .select("id, service_id, status, point_of_sale, document_number, issue_date, customer_id, technician_id, customer_name, total, created_at")
          .eq("company_id", companyId)
          .eq("doc_type", "REMITO")
          .in("service_id", serviceIds)
          .order("created_at", { ascending: false }),
      ]);
      const { data: assignmentsData, error: assignmentsError } = assignmentsResult;
      if (assignmentsError) throw assignmentsError;
      const { data: remitosData, error: remitosError } = remitosResult;
      if (remitosError) throw remitosError;

      const remitos = (remitosData ?? []) as ServiceMaterialRemito[];
      const remitoIds = remitos.map((remito) => remito.id);
      const lineStatsByDocument = new Map<string, { lineCount: number; estimatedCost: number }>();
      if (remitoIds.length > 0) {
        const { data: linesData, error: linesError } = await serviceDb
          .from("document_lines")
          .select("document_id, quantity, base_cost_snapshot")
          .in("document_id", remitoIds);
        if (linesError) throw linesError;
        for (const line of linesData ?? []) {
          const documentId = String(line.document_id);
          const current = lineStatsByDocument.get(documentId) ?? { lineCount: 0, estimatedCost: 0 };
          current.lineCount += 1;
          current.estimatedCost += (Number(line.quantity) || 0) * (Number(line.base_cost_snapshot) || 0);
          lineStatsByDocument.set(documentId, current);
        }
      }

      return {
        jobs,
        services,
        assignments: (assignmentsData ?? []) as ServiceTechnicianAssignment[],
        remitos: remitos.map((remito) => ({
          ...remito,
          total: Number(remito.total) || 0,
          lineCount: lineStatsByDocument.get(remito.id)?.lineCount ?? 0,
          estimatedCost: lineStatsByDocument.get(remito.id)?.estimatedCost ?? 0,
        })),
      };
    },
  });

  const linkableRemitosQuery = useQuery({
    queryKey: ["service-jobs", "linkable-remitos", companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("documents")
        .select("id, service_id, status, point_of_sale, document_number, issue_date, customer_id, technician_id, customer_name, total, created_at")
        .eq("company_id", companyId)
        .eq("doc_type", "REMITO")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data ?? []) as LinkableMaterialRemito[]).map((remito) => ({
        ...remito,
        total: Number(remito.total) || 0,
        lineCount: 0,
        estimatedCost: 0,
      }));
    },
  });

  const servicesByJobId = useMemo(() => {
    const assignmentsByService = new Map<string, ServiceTechnicianAssignment[]>();
    for (const assignment of jobsQuery.data?.assignments ?? []) {
      assignmentsByService.set(assignment.service_id, [...(assignmentsByService.get(assignment.service_id) ?? []), assignment]);
    }
    const remitosByService = new Map<string, ServiceMaterialRemito[]>();
    for (const remito of jobsQuery.data?.remitos ?? []) {
      if (!remito.service_id) continue;
      remitosByService.set(remito.service_id, [...(remitosByService.get(remito.service_id) ?? []), remito]);
    }

    const map = new Map<string, ServiceWithTechnicians[]>();
    for (const service of jobsQuery.data?.services ?? []) {
      const assignments = assignmentsByService.get(service.id) ?? [];
      const enriched: ServiceWithTechnicians = {
        ...service,
        technicianIds: assignments.map((assignment) => assignment.technician_id),
        technicianNames: assignments.map((assignment) => assignment.technicians?.name ?? "Tecnico").sort(),
        materialRemitos: remitosByService.get(service.id) ?? [],
      };
      map.set(service.job_id, [...(map.get(service.job_id) ?? []), enriched]);
    }
    return map;
  }, [jobsQuery.data?.assignments, jobsQuery.data?.remitos, jobsQuery.data?.services]);

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

  const createMaterialRemitoMutation = useMutation({
    mutationFn: async (payload: {
      service: ServiceWithTechnicians;
      customer: ServiceJobCustomer | null;
      pointOfSale: number;
    }) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de crear remitos");
      const body = buildServiceRemitoDraftPayload({
        companyId,
        userId,
        serviceId: payload.service.id,
        pointOfSale: payload.pointOfSale,
        customerId: payload.customer?.id ?? null,
        customerName: payload.customer?.name ?? null,
        customerTaxId: payload.customer?.cuit ?? null,
        technicianIds: payload.service.technicianIds,
      });
      const { data, error } = await serviceDb.from("documents").insert(body).select("id").single();
      if (error) throw error;
      const documentId = (data as { id: string }).id;
      await serviceDb.from("document_events").insert({
        document_id: documentId,
        event_type: "CREATED",
        payload: { source: "service_job", service_id: payload.service.id },
        created_by: userId ?? null,
      });
      return documentId;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        qc.invalidateQueries({ queryKey: queryKeys.documents.all() }),
      ]);
      toast({ title: "Remito borrador creado" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo crear el remito", description: getErrorMessage(error), variant: "destructive" }),
  });

  const linkMaterialRemitoMutation = useMutation({
    mutationFn: async (payload: { documentId: string; serviceId: string }) => {
      const { error } = await serviceDb
        .from("documents")
        .update({ service_id: payload.serviceId })
        .eq("id", payload.documentId)
        .eq("doc_type", "REMITO");
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        qc.invalidateQueries({ queryKey: queryKeys.documents.all() }),
      ]);
      toast({ title: "Remito vinculado al servicio" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo vincular el remito", description: getErrorMessage(error), variant: "destructive" }),
  });

  const unlinkMaterialRemitoMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await serviceDb
        .from("documents")
        .update({ service_id: null })
        .eq("id", documentId)
        .eq("doc_type", "REMITO");
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        qc.invalidateQueries({ queryKey: queryKeys.documents.all() }),
      ]);
      toast({ title: "Remito desvinculado" });
    },
    onError: (error: unknown) => toast({ title: "No se pudo desvincular", description: getErrorMessage(error), variant: "destructive" }),
  });

  return {
    customers: customersQuery.data ?? [],
    technicians: techniciansQuery.data ?? [],
    jobs,
    servicesByJobId,
    linkableRemitos: linkableRemitosQuery.data ?? [],
    isLoading: jobsQuery.isLoading,
    saveJobMutation,
    deleteJobMutation,
    saveServiceMutation,
    deleteServiceMutation,
    createMaterialRemitoMutation,
    linkMaterialRemitoMutation,
    unlinkMaterialRemitoMutation,
  };
}
