import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { serviceDb } from "../db";
import type { ServiceCustomer, ServiceDocument, ServiceDocumentAttachment, ServiceDocumentLine } from "../types";

type PublicPayload =
  | { status: "not_found" | "revoked" | "expired" }
  | {
      status: "ok";
      document: ServiceDocument;
      customer: ServiceCustomer | null;
      lines: ServiceDocumentLine[];
      attachments: ServiceDocumentAttachment[];
      company: Record<string, unknown>;
    };

export function usePublicServiceDocument(token: string | null) {
  return useQuery({
    queryKey: queryKeys.serviceDocuments.public(token),
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await serviceDb.rpc("get_public_service_document_payload", { p_token: token });
      if (error) throw error;
      const payload = data as PublicPayload;
      if (payload.status !== "ok") return payload;

      const attachments = await Promise.all(
        payload.attachments.map(async (attachment) => {
          const { data: signedData } = await supabase.storage
            .from(attachment.storage_bucket)
            .createSignedUrl(attachment.storage_path, 60 * 15);
          return { ...attachment, include_in_print: true, signed_url: signedData?.signedUrl ?? null };
        }),
      );

      return {
        ...payload,
        document: { ...payload.document, customers: payload.customer },
        attachments,
      };
    },
  });
}
