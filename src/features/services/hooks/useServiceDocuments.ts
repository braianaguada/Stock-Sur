import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { serviceDb } from "../db";
import type { ServiceDocument, ServiceDocumentStatus } from "../types";

export function useServiceDocuments(params: {
  companyId: string | null;
  search: string;
  status: ServiceDocumentStatus | "ALL";
  documentId?: string | null;
}) {
  const { companyId, search, status, documentId = null } = params;
  const trimmedSearch = search.trim();

  const customersQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.customers(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("customers")
        .select("id, name, cuit, email, phone")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const documentsQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.list(companyId, trimmedSearch, status),
    enabled: Boolean(companyId),
    queryFn: async () => {
      let query = serviceDb
        .from("service_documents")
        .select("*, customers(id, name, cuit, email, phone)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (status !== "ALL") query = query.eq("status", status);
      const { data, error } = await query.limit(300);
      if (error) throw error;
      const rows = (data ?? []) as ServiceDocument[];
      if (!trimmedSearch) return rows;
      const lowerSearch = trimmedSearch.toLowerCase();
      return rows.filter((document) => {
        const customerName = document.customers?.name?.toLowerCase() ?? "";
        const reference = document.reference?.toLowerCase() ?? "";
        const number = String(document.number);
        return customerName.includes(lowerSearch) || reference.includes(lowerSearch) || number.includes(lowerSearch);
      });
    },
  });

  const documentQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.detail(documentId),
    enabled: Boolean(documentId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("service_documents")
        .select("*, customers(id, name, cuit, email, phone)")
        .eq("id", documentId)
        .single();
      if (error) throw error;
      return data as ServiceDocument;
    },
  });

  const linesQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.lines(documentId),
    enabled: Boolean(documentId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("service_document_lines")
        .select("*")
        .eq("document_id", documentId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  return {
    customers: customersQuery.data ?? [],
    documents: documentsQuery.data ?? [],
    selectedDocument: documentQuery.data ?? null,
    selectedLines: linesQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
  };
}
