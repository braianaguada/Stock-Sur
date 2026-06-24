import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { serviceDb } from "../db";
import type { ServiceDocument, ServiceDocumentAttachment, ServiceDocumentEvent, ServiceDocumentShareLink, ServiceDocumentStatus } from "../types";

export function useServiceDocuments(params: {
  companyId: string | null;
  search: string;
  status: ServiceDocumentStatus | "ALL";
  customerId?: string;
  documentId?: string | null;
}) {
  const { companyId, search, status, customerId = "ALL", documentId = null } = params;
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
    queryKey: queryKeys.serviceDocuments.list(companyId, trimmedSearch, status, customerId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      let query = serviceDb
        .from("service_documents")
        .select("*, customers(id, name, cuit, email, phone)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (status !== "ALL") query = query.eq("status", status);
      if (customerId !== "ALL") query = query.eq("customer_id", customerId);
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
    queryKey: queryKeys.serviceDocuments.detail(companyId, documentId),
    enabled: Boolean(companyId && documentId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("service_documents")
        .select("*, customers(id, name, cuit, email, phone)")
        .eq("company_id", companyId)
        .eq("id", documentId)
        .single();
      if (error) throw error;
      return data as ServiceDocument;
    },
  });

  const linesQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.lines(companyId, documentId),
    enabled: Boolean(companyId && documentId),
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

  const attachmentsQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.attachments(companyId, documentId),
    enabled: Boolean(companyId && documentId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("service_document_attachments")
        .select("*")
        .eq("service_document_id", documentId)
        .order("sort_order");
      if (error) throw error;
      const attachments = (data ?? []) as ServiceDocumentAttachment[];
      return Promise.all(
        attachments.map(async (attachment) => {
          const { data: signedData } = await supabase.storage
            .from(attachment.storage_bucket)
            .createSignedUrl(attachment.storage_path, 60 * 30);
          return { ...attachment, signed_url: signedData?.signedUrl ?? null };
        }),
      );
    },
  });

  const shareLinksQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.shareLinks(companyId, documentId),
    enabled: Boolean(companyId && documentId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("service_document_share_links")
        .select("*")
        .eq("service_document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServiceDocumentShareLink[];
    },
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.serviceDocuments.events(companyId, documentId),
    enabled: Boolean(companyId && documentId),
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("service_document_events")
        .select("id, document_id, event_type, payload, created_at, created_by")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServiceDocumentEvent[];
    },
  });

  const eventUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of eventsQuery.data ?? []) {
      if (event.created_by) ids.add(event.created_by);
    }
    return Array.from(ids).sort();
  }, [eventsQuery.data]);

  const eventProfilesQuery = useQuery({
    queryKey: ["service-document-event-profiles", eventUserIds],
    enabled: eventUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await serviceDb
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", eventUserIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const eventUserNamesById = useMemo(
    () => new Map((eventProfilesQuery.data ?? []).map((profile) => [profile.user_id, profile.full_name?.trim() || "Usuario sin nombre"])),
    [eventProfilesQuery.data],
  );

  return {
    customers: customersQuery.data ?? [],
    documents: documentsQuery.data ?? [],
    selectedDocument: documentQuery.data ?? null,
    selectedLines: linesQuery.data ?? [],
    selectedAttachments: attachmentsQuery.data ?? [],
    selectedShareLinks: shareLinksQuery.data ?? [],
    selectedEvents: eventsQuery.data ?? [],
    eventUserNamesById,
    isLoading: documentsQuery.isLoading,
  };
}
