import { supabase } from "@/integrations/supabase/client";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import type { SupplierFormState } from "@/features/suppliers/types";

function buildSupplierPayload(form: SupplierFormState) {
  const taxId = form.tax_id.replace(/\D/g, "");
  return {
    name: form.name.trim(),
    legal_name: form.legal_name.trim() || null,
    tax_id: taxId || null,
    contact_name: form.contact_name.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    whatsapp: form.whatsapp.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
  };
}

export async function saveSupplier(params: {
  companyId: string;
  form: SupplierFormState;
  editingId?: string | null;
}) {
  const payload = buildSupplierPayload(params.form);

  if (params.editingId) {
    const { error } = await supabase
      .from("suppliers")
      .update(payload)
      .eq("company_id", params.companyId)
      .eq("id", params.editingId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("suppliers")
    .insert({ company_id: params.companyId, ...payload });
  if (error) throw error;
}

export async function deleteSupplier(companyId: string, supplierId: string) {
  await deleteByStrategy({ table: "suppliers", id: supplierId, eq: { company_id: companyId } });
}

export async function restoreSupplier(companyId: string, supplierId: string) {
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: true })
    .eq("company_id", companyId)
    .eq("id", supplierId);
  if (error) throw error;
}
