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
import type { Customer, CustomerFiscalDiagnostics } from "@/features/customers/types";
import { canUseCustomerForInvoiceA, getCuitValidationMessage, normalizeCuit } from "@/features/customers/fiscal";

const EMPTY_FORM: CustomerFormState = {
  name: "",
  cuit: "",
  email: "",
  phone: "",
  is_occasional: false,
  account_due_days: "30",
  fiscal_tax_id: "",
  fiscal_legal_name: "",
  fiscal_tax_condition: "",
  fiscal_address: "",
  fiscal_validation_status: "PENDING",
  fiscal_validated_at: null,
  fiscal_lookup_diagnostics: null,
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
  code?: string;
  diagnostics?: CustomerFiscalDiagnostics;
  profile?: Customer["fiscal_profile"];
};

function getFiscalDiagnosticsFromSnapshot(snapshot: unknown): CustomerFiscalDiagnostics | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const object = snapshot as { diagnostics?: unknown; code?: unknown; lookupEnvironment?: unknown };
  const candidate = object.diagnostics && typeof object.diagnostics === "object" ? object.diagnostics : object;
  if (!candidate || typeof candidate !== "object") return null;
  const diagnostics = candidate as Partial<CustomerFiscalDiagnostics>;
  if (typeof diagnostics.code !== "string" || typeof diagnostics.lookupEnvironment !== "string") return null;
  return {
    ok: Boolean(diagnostics.ok),
    code: diagnostics.code,
    message: typeof diagnostics.message === "string" ? diagnostics.message : "",
    lookupEnvironment: diagnostics.lookupEnvironment,
    billingEnvironment: typeof diagnostics.billingEnvironment === "string" ? diagnostics.billingEnvironment : "dev",
    wsid: typeof diagnostics.wsid === "string" ? diagnostics.wsid : "ws_sr_constancia_inscripcion",
    method: typeof diagnostics.method === "string" ? diagnostics.method : "getPersona_v2",
    issuerTaxIdMasked: typeof diagnostics.issuerTaxIdMasked === "string" ? diagnostics.issuerTaxIdMasked : "[missing]",
    warning: typeof diagnostics.warning === "string" ? diagnostics.warning : null,
    taxpayerFound: Boolean(diagnostics.taxpayerFound),
    hasDatosGenerales: Boolean(diagnostics.hasDatosGenerales),
    hasRegimenGeneral: Boolean(diagnostics.hasRegimenGeneral),
    hasImpuestos: Boolean(diagnostics.hasImpuestos),
    hasMonotributo: Boolean(diagnostics.hasMonotributo),
    taxpayerStatus: typeof diagnostics.taxpayerStatus === "string" ? diagnostics.taxpayerStatus : null,
    legalNameFound: Boolean(diagnostics.legalNameFound),
    taxCondition: typeof diagnostics.taxCondition === "string" ? diagnostics.taxCondition : "UNKNOWN",
    eligibleForInvoiceA: Boolean(diagnostics.eligibleForInvoiceA),
    reason: typeof diagnostics.reason === "string" ? diagnostics.reason : null,
    normalizationReason: typeof diagnostics.normalizationReason === "string" ? diagnostics.normalizationReason : null,
    availableTaxIds: Array.isArray(diagnostics.availableTaxIds) ? diagnostics.availableTaxIds : [],
    availableTaxDescriptions: Array.isArray(diagnostics.availableTaxDescriptions) ? diagnostics.availableTaxDescriptions : [],
  };
}

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
        account_due_days: Math.max(0, Math.min(3650, Math.trunc(Number(form.account_due_days) || 0))),
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
          fiscal_legal_name: profile.legal_name ?? "",
          fiscal_tax_condition: profile.tax_condition ?? "",
          fiscal_address: profile.fiscal_address ?? "",
          fiscal_validation_status: profile.validation_status,
          fiscal_validated_at: profile.validated_at,
          fiscal_lookup_diagnostics: result.diagnostics ?? getFiscalDiagnosticsFromSnapshot(profile.validation_snapshot),
        }));
      } else if (result.diagnostics) {
        setForm((current) => ({ ...current, fiscal_lookup_diagnostics: result.diagnostics ?? null }));
      }
      if (isControlledError) {
        toast({
          title: "No se pudo validar el CUIT",
          description: result.diagnostics?.message || result.error || "El perfil fiscal quedo marcado con error.",
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
      account_due_days: String(customer.account_due_days ?? 30),
      fiscal_tax_id: customer.fiscal_profile?.tax_id ?? customer.cuit ?? "",
      fiscal_legal_name: customer.fiscal_profile?.legal_name ?? "",
      fiscal_tax_condition: customer.fiscal_profile?.tax_condition ?? "",
      fiscal_address: customer.fiscal_profile?.fiscal_address ?? "",
      fiscal_validation_status: customer.fiscal_profile?.validation_status ?? "PENDING",
      fiscal_validated_at: customer.fiscal_profile?.validated_at ?? null,
      fiscal_lookup_diagnostics: getFiscalDiagnosticsFromSnapshot(customer.fiscal_profile?.validation_snapshot),
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
