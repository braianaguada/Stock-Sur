import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { getErrorMessage } from "@/lib/errors";
import { invalidateCustomerQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerFormState } from "@/features/customers/components/CustomerFormDialog";
import type { Customer } from "@/features/customers/types";

const EMPTY_FORM: CustomerFormState = {
  name: "",
  cuit: "",
  email: "",
  phone: "",
  is_occasional: false,
};

type UseCustomersPageOptions = {
  companyId: string | null | undefined;
  userId: string | null | undefined;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
};

export function useCustomersPage({
  companyId,
  userId,
  toast,
}: UseCustomersPageOptions) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const qc = useQueryClient();

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(companyId ?? null, deferredSearch),
    enabled: Boolean(companyId),
    queryFn: async () => {
      let query = supabase.from("customers").select("*").eq("company_id", companyId!).order("name");
      if (deferredSearch) {
        query = query.or(`name.ilike.%${deferredSearch}%,cuit.ilike.%${deferredSearch}%`);
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as Customer[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: companyId!,
        name: form.name,
        cuit: form.cuit || null,
        email: form.email || null,
        phone: form.phone || null,
        is_occasional: form.is_occasional,
        created_by: userId ?? null,
      };

      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("customers").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCustomerQueries(qc);
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: editing ? "Cliente actualizado" : "Cliente creado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteByStrategy({ table: "customers", id });
    },
    onSuccess: async () => {
      await invalidateCustomerQueries(qc);
      toast({ title: "Cliente eliminado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al eliminar",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      cuit: customer.cuit ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      is_occasional: customer.is_occasional,
    });
    setDialogOpen(true);
  };

  return {
    customerToDelete,
    customers: customersQuery.data ?? [],
    dialogOpen,
    editing,
    form,
    isLoading: customersQuery.isLoading,
    saveMutation,
    deleteMutation,
    search,
    setCustomerToDelete,
    setDialogOpen,
    setForm,
    setSearch,
    openCreate,
    openEdit,
  };
}
