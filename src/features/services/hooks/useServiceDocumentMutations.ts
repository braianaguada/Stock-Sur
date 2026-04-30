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
  editingDocumentId: string | null;
  form: ServiceDocumentForm;
  lines: ServiceDocumentLine[];
  toast: ToastFn;
  onDone: () => void;
}) {
  const { companyId, editingDocumentId, form, lines, toast, onDone } = params;
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

      const { error } = await serviceDb.rpc("save_service_document", {
        p_document_id: editingDocumentId,
        p_company_id: companyId,
        p_customer_id: form.customer_id,
        p_status: form.status,
        p_reference: form.reference.trim() || null,
        p_issue_date: form.issue_date,
        p_valid_until: form.valid_until || null,
        p_delivery_time: form.delivery_time.trim() || null,
        p_payment_terms: form.payment_terms.trim() || null,
        p_delivery_location: form.delivery_location.trim() || null,
        p_intro_text: form.intro_text.trim() || null,
        p_closing_text: form.closing_text.trim() || null,
        p_currency: form.currency || "ARS",
        p_lines: validLines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unit: line.unit?.trim() || null,
          unit_price: line.unit_price,
          line_total: line.line_total,
        })),
      });
      if (error) throw error;
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

  const duplicateMutation = useMutation({
    mutationFn: async (sourceDocumentId: string) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de duplicar presupuestos de servicio");

      const { error } = await serviceDb.rpc("create_service_document_copy", {
        p_source_document_id: sourceDocumentId,
        p_target_type: "QUOTE",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.serviceDocuments.all() });
      toast({ title: "Presupuesto duplicado" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo duplicar", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const convertToRemitoMutation = useMutation({
    mutationFn: async (sourceDocumentId: string) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de convertir a remito");

      const { error } = await serviceDb.rpc("create_service_document_copy", {
        p_source_document_id: sourceDocumentId,
        p_target_type: "REMITO",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.serviceDocuments.all() });
      toast({ title: "Remito de servicio creado" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo convertir a remito", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (params: { documentId: string; targetStatus: string }) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de cambiar estados");
      const { error } = await serviceDb.rpc("transition_service_document_status", {
        p_document_id: params.documentId,
        p_target_status: params.targetStatus,
      });
      if (error) throw error;

    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.serviceDocuments.all() });
      toast({ title: "Estado actualizado" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo cambiar el estado", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  return { upsertMutation, duplicateMutation, convertToRemitoMutation, transitionMutation };
}
