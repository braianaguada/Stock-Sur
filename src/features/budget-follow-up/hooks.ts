import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { BudgetDocument, BudgetFollowUp, BudgetPriority } from "./types";

export function useBudgetFollowUpData(companyId: string | null) {
  const budgetsQuery = useQuery({
    queryKey: ["documents", "budget-follow-up-budgets", companyId ?? "no-company"],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, status, point_of_sale, document_number, issue_date, valid_until, customer_name, total")
        .eq("company_id", companyId!)
        .eq("doc_type", "PRESUPUESTO")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, total: Number(row.total) })) as BudgetDocument[];
    },
  });

  const followUpsQuery = useQuery({
    queryKey: queryKeys.documents.budgetFollowUps(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_follow_ups")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []) as BudgetFollowUp[];
    },
  });

  return {
    budgets: budgetsQuery.data ?? [],
    followUps: followUpsQuery.data ?? [],
    isLoading: budgetsQuery.isLoading || followUpsQuery.isLoading,
    isError: budgetsQuery.isError || followUpsQuery.isError,
    error: budgetsQuery.error ?? followUpsQuery.error,
  };
}

type SaveFollowUpInput = {
  documentId: string;
  priority: BudgetPriority;
  nextContactOn: string | null;
  notes: string | null;
};

export function useBudgetFollowUpMutations(companyId: string | null, userId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.documents.budgetFollowUps(companyId) });

  const saveMutation = useMutation({
    mutationFn: async (input: SaveFollowUpInput) => {
      if (!companyId || !userId) throw new Error("Selecciona una empresa activa para guardar el seguimiento.");
      const { error } = await supabase.from("budget_follow_ups").upsert({
        company_id: companyId,
        document_id: input.documentId,
        priority: input.priority,
        next_contact_on: input.nextContactOn,
        notes: input.notes,
        created_by: userId,
        updated_by: userId,
      }, { onConflict: "company_id,document_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markContactedMutation = useMutation({
    mutationFn: async ({ documentId, current }: { documentId: string; current: BudgetFollowUp | null }) => {
      if (!companyId || !userId) throw new Error("Selecciona una empresa activa para registrar el contacto.");
      const { error } = await supabase.from("budget_follow_ups").upsert({
        company_id: companyId,
        document_id: documentId,
        priority: current?.priority ?? "NORMAL",
        next_contact_on: current?.next_contact_on ?? null,
        notes: current?.notes ?? null,
        contact_count: (current?.contact_count ?? 0) + 1,
        last_contacted_at: new Date().toISOString(),
        created_by: current?.created_by ?? userId,
        updated_by: userId,
      }, { onConflict: "company_id,document_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { saveMutation, markContactedMutation };
}
