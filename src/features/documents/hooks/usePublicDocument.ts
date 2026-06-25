import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocLineRow, DocRow } from "../types";

type PublicPayload =
  | { status: "not_found" | "revoked" | "expired" }
  | {
      status: "ok";
      document: DocRow;
      lines: DocLineRow[];
      technician_name: string | null;
      company: Record<string, unknown>;
    };

export function usePublicDocument(token: string | null) {
  return useQuery({
    queryKey: ["public-document", token ?? "no-token"],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_document_payload", { p_token: token });
      if (error) throw error;
      return data as PublicPayload;
    },
  });
}
