import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { fetchAllPages, fetchAllPagesByChunks } from "@/lib/supabase-pagination";
import {
  buildMaterialControlReport,
  type MaterialControlDocType,
  type MaterialControlDocument,
  type MaterialControlFilters,
  type MaterialControlLine,
  type MaterialControlService,
  type MaterialControlTechnician,
} from "../materialControl";

export type QuickRange = "today" | "week" | "month" | "previousMonth" | "custom";

export type TechnicianMaterialControlState = MaterialControlFilters & {
  range: QuickRange;
  dateFrom: string;
  dateTo: string;
};

const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

function datePartsInBuenosAires(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear()),
    month: Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate()),
  };
}

function toDateInput(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDefaultMaterialControlState(now = new Date()): TechnicianMaterialControlState {
  const { year, month } = datePartsInBuenosAires(now);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    range: "month",
    dateFrom: toDateInput(year, month, 1),
    dateTo: toDateInput(year, month, lastDay),
    technicianId: "ALL",
    customerId: "ALL",
    serviceId: "ALL",
    type: "ALL",
    search: "",
  };
}

export function getRangeDates(range: QuickRange, current: Pick<TechnicianMaterialControlState, "dateFrom" | "dateTo">, now = new Date()) {
  if (range === "custom") return current;
  const parts = datePartsInBuenosAires(now);
  const todayUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (range === "today") {
    const value = toDateInput(parts.year, parts.month, parts.day);
    return { dateFrom: value, dateTo: value };
  }

  if (range === "week") {
    const dayOfWeek = todayUtc.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayUtc);
    monday.setUTCDate(todayUtc.getUTCDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      dateFrom: toDateInput(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
      dateTo: toDateInput(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, sunday.getUTCDate()),
    };
  }

  if (range === "previousMonth") {
    const previous = new Date(Date.UTC(parts.year, parts.month - 2, 1));
    const previousYear = previous.getUTCFullYear();
    const previousMonth = previous.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
    return {
      dateFrom: toDateInput(previousYear, previousMonth, 1),
      dateTo: toDateInput(previousYear, previousMonth, lastDay),
    };
  }

  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return {
    dateFrom: toDateInput(parts.year, parts.month, 1),
    dateTo: toDateInput(parts.year, parts.month, lastDay),
  };
}

type RawService = {
  id: string;
  title: string;
  job_id: string;
  service_jobs?: {
    id: string;
    title: string;
    customers?: { id: string; name: string } | { id: string; name: string }[] | null;
  } | {
    id: string;
    title: string;
    customers?: { id: string; name: string } | { id: string; name: string }[] | null;
  }[] | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function useTechnicianMaterialControl({
  companyId,
  state,
}: {
  companyId: string | null | undefined;
  state: TechnicianMaterialControlState;
}) {
  const documentsQuery = useQuery({
    queryKey: queryKeys.technicians.materialControl.documents(companyId ?? null, state.dateFrom, state.dateTo),
    enabled: Boolean(companyId && state.dateFrom && state.dateTo),
    queryFn: async () => {
      const data = await fetchAllPages(() =>
        supabase
          .from("documents")
          .select("id, doc_type, status, point_of_sale, document_number, issue_date, technician_id, customer_id, customer_name, service_id, origin_document_id, source_document_id, source_document_number_snapshot, external_invoice_number, total, created_at")
          .eq("company_id", companyId!)
          .in("doc_type", ["REMITO", "REMITO_DEVOLUCION"] satisfies MaterialControlDocType[])
          .gte("issue_date", state.dateFrom)
          .lte("issue_date", state.dateTo)
          .order("issue_date", { ascending: false })
          .order("id", { ascending: false }),
      );
      return data.map((document) => ({ ...document, total: Number(document.total) || 0 })) as MaterialControlDocument[];
    },
  });

  const documentIds = useMemo(() => (documentsQuery.data ?? []).map((document) => document.id), [documentsQuery.data]);
  const serviceIds = useMemo(
    () => Array.from(new Set((documentsQuery.data ?? []).map((document) => document.service_id).filter(Boolean))) as string[],
    [documentsQuery.data],
  );

  const linesQuery = useQuery({
    queryKey: queryKeys.technicians.materialControl.lines(companyId ?? null, documentIds.join(",")),
    enabled: Boolean(companyId) && documentIds.length > 0,
    queryFn: async () => {
      const data = await fetchAllPagesByChunks(documentIds, (ids) =>
        supabase
          .from("document_lines")
          .select("id, document_id, item_id, description, sku_snapshot, quantity, unit_price, line_total, base_cost_snapshot")
          .in("document_id", ids)
          .order("line_order")
          .order("id"),
      );
      return data.map((line) => ({
        ...line,
        quantity: Number(line.quantity) || 0,
        unit_price: Number(line.unit_price) || 0,
        line_total: Number(line.line_total) || 0,
        base_cost_snapshot: line.base_cost_snapshot == null ? null : Number(line.base_cost_snapshot),
      })) as MaterialControlLine[];
    },
  });

  const techniciansQuery = useQuery({
    queryKey: queryKeys.technicians.materialControl.technicians(companyId ?? null),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const data = await fetchAllPages(() =>
        supabase
          .from("technicians")
          .select("*")
          .eq("company_id", companyId!)
          .order("name")
          .order("id"),
      );
      return (data as MaterialControlTechnician[])
        .map((technician) => ({ ...technician, is_active: technician.is_active ?? true }));
    },
  });

  const customersQuery = useQuery({
    queryKey: queryKeys.technicians.materialControl.customers(companyId ?? null),
    enabled: Boolean(companyId),
    queryFn: async () => {
      return fetchAllPages(() =>
        supabase
          .from("customers")
          .select("id, name")
          .eq("company_id", companyId!)
          .order("name")
          .order("id"),
      );
    },
  });

  const servicesQuery = useQuery({
    queryKey: queryKeys.technicians.materialControl.services(companyId ?? null, serviceIds.join(",")),
    enabled: Boolean(companyId) && serviceIds.length > 0,
    queryFn: async () => {
      const data = await fetchAllPagesByChunks(serviceIds, (ids) =>
        supabase
          .from("service_job_services")
          .select("id, title, job_id, service_jobs(id, title, customers(id, name))")
          .eq("company_id", companyId!)
          .in("id", ids)
          .order("id"),
      );
      return (data as RawService[]).map((service) => {
        const job = first(service.service_jobs);
        const customer = first(job?.customers);
        return {
          id: service.id,
          title: service.title,
          job_id: service.job_id,
          jobTitle: job?.title ?? "Trabajo sin titulo",
          customerName: customer?.name ?? null,
        };
      }) as MaterialControlService[];
    },
  });

  const report = useMemo(
    () => buildMaterialControlReport({
      documents: documentsQuery.data ?? [],
      lines: linesQuery.data ?? [],
      technicians: techniciansQuery.data ?? [],
      services: servicesQuery.data ?? [],
      filters: {
        technicianId: state.technicianId,
        customerId: state.customerId,
        serviceId: state.serviceId,
        type: state.type,
        search: state.search,
      },
    }),
    [documentsQuery.data, linesQuery.data, servicesQuery.data, state.customerId, state.search, state.serviceId, state.technicianId, state.type, techniciansQuery.data],
  );

  return {
    report,
    documents: documentsQuery.data ?? [],
    technicians: techniciansQuery.data ?? [],
    customers: customersQuery.data ?? [],
    services: servicesQuery.data ?? [],
    isLoading: documentsQuery.isLoading || linesQuery.isLoading || techniciansQuery.isLoading || customersQuery.isLoading || servicesQuery.isLoading,
    isError: documentsQuery.isError || linesQuery.isError || techniciansQuery.isError || customersQuery.isError || servicesQuery.isError,
  };
}
