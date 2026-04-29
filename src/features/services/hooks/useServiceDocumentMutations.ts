import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query-keys";
import { serviceDb } from "../db";
import type { ServiceDocumentForm, ServiceDocumentLine } from "../types";

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

export function calculateServiceLineTotal(line: ServiceDocumentLine) {
  const quantity = Number(line.quantity ?? 0);
  const unitPrice = Number(line.unit_price ?? 0);
  return quantity > 0 && unitPrice > 0 ? quantity * unitPrice : Number(line.line_total ?? 0);
}

export function useServiceDocumentMutations(params: {
  companyId: string | null;
  userId: string | undefined;
  editingDocumentId: string | null;
  form: ServiceDocumentForm;
  lines: ServiceDocumentLine[];
  toast: ToastFn;
  onDone: () => void;
}) {
  const { companyId, userId, editingDocumentId, form, lines, toast, onDone } = params;
  const qc = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Selecciona una empresa antes de crear presupuestos de servicio");
      if (!form.customer_id) throw new Error("Selecciona un cliente");

      const validLines = lines
        .map((line, index) => ({
          ...line,
          description: line.description.trim(),
          line_total: calculateServiceLineTotal(line),
          sort_order: index + 1,
        }))
        .filter((line) => line.description);

      if (validLines.length === 0) throw new Error("Agrega al menos una linea de servicio");

      const total = validLines.reduce((sum, line) => sum + Number(line.line_total ?? 0), 0);
      const payload = {
        company_id: companyId,
        customer_id: form.customer_id,
        type: "QUOTE",
        status: form.status,
        reference: form.reference.trim() || null,
        issue_date: form.issue_date,
        valid_until: form.valid_until || null,
        delivery_time: form.delivery_time.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
        delivery_location: form.delivery_location.trim() || null,
        intro_text: form.intro_text.trim() || null,
        closing_text: form.closing_text.trim() || null,
        subtotal: total,
        total,
        currency: form.currency || "ARS",
        created_by: userId,
      };

      let documentId = editingDocumentId;
      if (documentId) {
        const { error } = await serviceDb
          .from("service_documents")
          .update(payload)
          .eq("id", documentId)
          .eq("status", "DRAFT");
        if (error) throw error;

        const { error: deleteError } = await serviceDb
          .from("service_document_lines")
          .delete()
          .eq("document_id", documentId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await serviceDb
          .from("service_documents")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        documentId = (data as { id: string }).id;
      }

      const linePayload = validLines.map((line) => ({
        document_id: documentId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit?.trim() || null,
        unit_price: line.unit_price,
        line_total: line.line_total,
        sort_order: line.sort_order,
      }));

      const { error: lineError } = await serviceDb.from("service_document_lines").insert(linePayload);
      if (lineError) throw lineError;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.serviceDocuments.all() });
      onDone();
      toast({ title: editingDocumentId ? "Presupuesto actualizado" : "Presupuesto creado" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  return { upsertMutation };
}
