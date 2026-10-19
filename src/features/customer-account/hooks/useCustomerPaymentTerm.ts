import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function validatePaymentTerm(value: string): number {
  const days = Number(value);
  if (!value.trim() || !Number.isInteger(days) || days < 0 || days > 3650) {
    throw new Error("Ingresá un plazo entero entre 0 y 3650 días.");
  }
  return days;
}

export function useCustomerPaymentTerm(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, days }: { customerId: string; days: string }) => {
      if (!companyId) throw new Error("Seleccioná una empresa.");
      const { data, error } = await supabase.from("customers")
        .update({ account_due_days: validatePaymentTerm(days) })
        .eq("company_id", companyId).eq("id", customerId)
        .select("id").single();
      if (error) throw error;
      if (!data) throw new Error("No se pudo actualizar el cliente.");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["customer-account-statement", companyId] }),
      ]);
    },
  });
}
