import { supabase } from "@/integrations/supabase/client";
import { buildDocumentShareMessage, buildPublicDocumentUrl, type ShareableDocument } from "../share";
import type { DocumentShareLink } from "../types";

export async function createDocumentShareLink(documentId: string) {
  const { data, error } = await supabase.rpc("create_document_share_link", {
    p_document_id: documentId,
    p_expires_at: null,
  });
  if (error) throw error;
  const link = data as unknown as DocumentShareLink | null;
  if (!link?.enabled || !link.token) throw new Error("No se pudo generar el enlace. Reintenta desde Compartir.");
  return link;
}

// Reload after emission so the message uses the number assigned by the database.
export async function prepareIssuedBudgetShare(companyId: string, documentId: string) {
  const { data, error } = await supabase.from("documents")
    .select("id, doc_type, document_number, point_of_sale, total, customer_id")
    .eq("company_id", companyId)
    .eq("id", documentId)
    .eq("doc_type", "PRESUPUESTO")
    .eq("status", "ENVIADO")
    .single();
  if (error) throw error;
  if (!data || data.document_number == null) throw new Error("El presupuesto emitido no esta disponible. Reintenta desde Compartir.");
  const document: ShareableDocument = data;
  const link = await createDocumentShareLink(documentId);
  return { document, link, message: buildDocumentShareMessage(document, buildPublicDocumentUrl(link.token)) };
}
