import { supabase } from "@/integrations/supabase/client";
import { serviceDb } from "./db";
import type {
  ServiceDocumentAttachment,
  ServiceDocumentLine,
  ServiceDocumentShareLink,
} from "./types";

function requireCompanyId(companyId: string | null): asserts companyId is string {
  if (!companyId) throw new Error("Selecciona una empresa para continuar");
}

export async function acceptServiceDocumentAiSuggestion(params: {
  companyId: string | null;
  suggestionId: string;
  documentId: string;
}) {
  requireCompanyId(params.companyId);
  const { error } = await serviceDb
    .from("service_document_ai_suggestions")
    .update({
      accepted: true,
      accepted_at: new Date().toISOString(),
      service_document_id: params.documentId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.suggestionId);
  if (error) throw error;
}

export async function createServiceAttachmentSignedUrl(
  attachment: ServiceDocumentAttachment,
  expiresInSeconds = 1800,
) {
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, expiresInSeconds);
  if (error) return { ...attachment, signed_url: null };
  return { ...attachment, signed_url: data?.signedUrl ?? null };
}

export async function fetchServiceDocumentPrintResources(
  companyId: string | null,
  documentId: string,
): Promise<{ lines: ServiceDocumentLine[]; attachments: ServiceDocumentAttachment[] }> {
  requireCompanyId(companyId);
  const [linesResult, attachmentsResult] = await Promise.all([
    serviceDb
      .from("service_document_lines")
      .select("id, document_id, description, quantity, unit, unit_price, line_total, sort_order, line_type")
      .eq("document_id", documentId)
      .order("sort_order"),
    serviceDb
      .from("service_document_attachments")
      .select("*")
      .eq("company_id", companyId)
      .eq("service_document_id", documentId)
      .eq("include_in_print", true)
      .order("sort_order"),
  ]);
  if (linesResult.error) throw linesResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  const attachments = await Promise.all(
    ((attachmentsResult.data ?? []) as ServiceDocumentAttachment[]).map((attachment) =>
      createServiceAttachmentSignedUrl(attachment)),
  );
  return {
    lines: (linesResult.data ?? []) as ServiceDocumentLine[],
    attachments,
  };
}

export async function fetchActiveServiceDocumentShareLink(
  companyId: string | null,
  documentId: string,
) {
  requireCompanyId(companyId);
  const { data, error } = await serviceDb
    .from("service_document_share_links")
    .select("*")
    .eq("company_id", companyId)
    .eq("service_document_id", documentId)
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data as ServiceDocumentShareLink[] | null)?.[0] ?? null);
}

export async function createServiceDocumentShareLink(documentId: string) {
  const { data, error } = await serviceDb.rpc("create_service_document_share_link", {
    p_service_document_id: documentId,
    p_expires_at: null,
  });
  if (error) throw error;
  return data as ServiceDocumentShareLink;
}

export async function revokeServiceDocumentShareLink(token: string) {
  const { error } = await serviceDb.rpc("revoke_service_document_share_link", { p_token: token });
  if (error) throw error;
}
