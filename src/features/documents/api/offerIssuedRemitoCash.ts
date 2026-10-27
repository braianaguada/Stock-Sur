import { supabase } from "@/integrations/supabase/client";
import type { DocRow } from "../types";

export async function offerIssuedRemitoCash({
  companyId, documentId, canRegister, isCurrentCompany, onOpen, onError,
}: {
  companyId: string | null;
  documentId: string;
  canRegister: boolean;
  isCurrentCompany: () => boolean;
  onOpen: (document: DocRow) => void;
  onError: () => void;
}) {
  if (!canRegister || !companyId || !isCurrentCompany()) return;
  const { data, error } = await supabase.from("documents").select("*")
    .eq("company_id", companyId).eq("id", documentId).eq("status", "EMITIDO").maybeSingle();
  if (!isCurrentCompany()) return;
  if (error) { onError(); return; }
  if (data?.doc_type === "REMITO") onOpen(data as DocRow);
}
