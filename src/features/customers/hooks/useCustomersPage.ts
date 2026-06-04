import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { getErrorMessage } from "@/lib/errors";
import { invalidateCustomerQueries } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { useSearch } from "@/hooks/useSearch";
import { searchIncludes } from "@/lib/search";
import type { CustomerFormState } from "@/features/customers/components/CustomerFormDialog";
import type { Customer } from "@/features/customers/types";
import { canUseCustomerForInvoiceA, getCuitValidationMessage, normalizeCuit } from "@/features/customers/fiscal";

const EMPTY_FORM: CustomerFormState = {
  name: "",
  cuit: "",
  email: "",
  phone: "",
  is_occasional: false,
  fiscal_tax_id: "",
  fiscal_legal_name: "",
  fiscal_tax_condition: "",
  fiscal_address: "",
  fiscal_validation_status: "PENDING",
};

function isValidOptionalEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type CustomerFiscalLookupResult = {
  ok?: boolean;
  error?: string;
  profile?: Customer["fiscal_profile"];
};

async function getFunctionErrorMessage(error: unknown) {
  const context = typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: unknown }).context
    : null;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown; message?: unknown };
      const message = typeof payload.error === "string" ? payload.error : payload.message;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // Fall back to the SDK error message below.
    }
  }

  return getErrorMessage(error);
}

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
  const { search, deferredSearch, setSearch, trimmedSearch } = useSearch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const qc = useQueryClient();

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(companyId ?? null, trimmedSearch),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const query = supabase
        .from("customers")
        .select("*, customer_fiscal_profiles(*)")
        .eq("company_id", companyId!)
        .order("name");
      const { data, error } = await query.limit(200);
      if (error) throw error;
      const rows = ((data ?? []) as Array<Customer & { customer_fiscal_profiles?: unknown[] }>).map((customer) => ({
        ...customer,
        fiscal_profile: Array.isArray(customer.customer_fiscal_profiles)
          ? customer.customer_fiscal_profiles[0] ?? null
          : null,
      })) as Customer[];
      if (!trimmedSearch) return rows;
      return rows.filter((customer) =>
        searchIncludes([customer.name, customer.cuit, customer.email, customer.phone].filter(Boolean).join(" "), trimmedSearch),
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("El nombre comercial / contacto es obligatorio.");
      if (!isValidOptionalEmail(form.email)) throw new Error("El email no tiene un formato valido.");
      if (form.phone.trim() && looksLikeEmail(form.phone)) throw new Error("El telefono no puede ser un email.");
      const normalizedFiscalTaxId = normalizeCuit(form.fiscal_tax_id);
      if (normalizedFiscalTaxId) {
        const taxIdError = getCuitValidationMessage(normalizedFiscalTaxId);
        if (taxIdError) throw new Error(taxIdError);
      }

      const payload = {
        company_id: companyId!,
        name: form.name.trim(),
        cuit: normalizedFiscalTaxId || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        is_occasional: false,
        created_by: userId ?? null,
      };

      let customerId = editing?.id ?? "";
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("customers").insert(payload).select("id").single();
        if (error) throw error;
        customerId = data.id;
      }

      return customerId;
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

  const validateFiscalMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Primero guarda el cliente antes de validar el CUIT.");
      const taxId = normalizeCuit(form.fiscal_tax_id || form.cuit);
      const taxIdError = getCuitValidationMessage(taxId);
      if (taxIdError) throw new Error(taxIdError);

      const { data, error } = await supabase.functions.invoke("customer-fiscal-lookup", {
        body: {
          customerId: editing.id,
          taxId,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      return data as CustomerFiscalLookupResult;
    },
    onSuccess: async (result) => {
      await invalidateCustomerQueries(qc);
      const profile = result?.profile;
      const isControlledError = Boolean(result?.error || result?.ok === false);
      if (profile) {
        setForm((current) => ({
          ...current,
          fiscal_tax_id: profile.tax_id || current.fiscal_tax_id,
          fiscal_legal_name: isControlledError
            ? current.fiscal_legal_name || profile.legal_name
            : profile.legal_name,
          fiscal_tax_condition: isControlledError
            ? current.fiscal_tax_condition || (profile.tax_condition ?? "")
            : profile.tax_condition ?? "",
          fiscal_address: isControlledError
            ? current.fiscal_address || (profile.fiscal_address ?? "")
            : profile.fiscal_address ?? "",
          fiscal_validation_status: profile.validation_status,
        }));
      }
      if (isControlledError) {
        toast({
          title: "No se pudo validar el CUIT",
          description: result.error ?? "El perfil fiscal quedo marcado con error.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "CUIT validado", description: "Se actualizo el perfil fiscal del cliente." });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo validar el CUIT",
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
      fiscal_tax_id: customer.fiscal_profile?.tax_id ?? customer.cuit ?? "",
      fiscal_legal_name: customer.fiscal_profile?.legal_name ?? "",
      fiscal_tax_condition: customer.fiscal_profile?.tax_condition ?? "",
      fiscal_address: customer.fiscal_profile?.fiscal_address ?? "",
      fiscal_validation_status: customer.fiscal_profile?.validation_status ?? "PENDING",
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
    validateFiscalMutation,
    deleteMutation,
    search,
    setCustomerToDelete,
    setDialogOpen,
    setForm,
    setSearch,
    openCreate,
    openEdit,
    canUseCustomerForInvoiceA,
  };
}
