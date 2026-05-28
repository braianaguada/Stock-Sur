import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query-keys";
import { serviceDb } from "../db";
import type { ServiceDocument, ServiceDocumentAttachmentDraft, ServiceDocumentForm, ServiceDocumentLine } from "../types";

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

export function calculateServiceLineTotal(line: ServiceDocumentLine) {
  const quantity = Number(line.quantity ?? 0);
  const unitPrice = Number(line.unit_price ?? 0);
  return quantity > 0 && unitPrice > 0 ? quantity * unitPrice : Number(line.line_total ?? 0);
}

function parseOptionalNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useServiceDocumentMutations(params: {
  companyId: string | null;
  editingDocumentId: string | null;
  form: ServiceDocumentForm;
  lines: ServiceDocumentLine[];
  attachments?: ServiceDocumentAttachmentDraft[];
  toast: ToastFn;
  onDone: () => void;
}) {
  const { companyId, editingDocumentId, form, lines, attachments = [], toast, onDone } = params;
  const qc = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Selecciona una empresa antes de crear presupuestos de servicio");
      if (!form.customer_id) throw new Error("Selecciona un cliente");

      const isGlobalTotal = form.pricing_mode === "GLOBAL_TOTAL";
      const globalTotal = parseOptionalNumber(form.global_total);
      if (isGlobalTotal && (globalTotal == null || globalTotal < 0)) throw new Error("Carga un precio final global valido");
      if (form.currency === "USD" && !parseOptionalNumber(form.exchange_rate)) throw new Error("Carga la cotizacion USD antes de guardar");

      const validLines = lines
        .map((line, index) => ({
          ...line,
          description: line.description.trim(),
          unit_price: isGlobalTotal ? null : line.unit_price,
          line_total: isGlobalTotal ? 0 : calculateServiceLineTotal(line),
          sort_order: index + 1,
        }))
        .filter((line) => line.description);

      if (validLines.length === 0) throw new Error("Agrega al menos una linea de servicio");

      const { data, error } = await serviceDb.rpc("save_service_document", {
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
        p_exchange_rate_source: form.currency === "USD" ? form.exchange_rate_source : null,
        p_exchange_rate: form.currency === "USD" ? parseOptionalNumber(form.exchange_rate) : null,
        p_exchange_rate_date: form.currency === "USD" ? form.exchange_rate_date || null : null,
        p_exchange_rate_fetched_at: form.currency === "USD" ? form.exchange_rate_fetched_at || null : null,
        p_exchange_rate_snapshot_label: form.currency === "USD" ? form.exchange_rate_snapshot_label.trim() || null : null,
        p_show_exchange_rate_note: form.show_exchange_rate_note,
        p_pricing_mode: form.pricing_mode,
        p_global_total: isGlobalTotal ? globalTotal : null,
        p_hide_line_prices: form.hide_line_prices || isGlobalTotal,
      });
      if (error) throw error;
      const savedDocument = data as ServiceDocument | null;
      if (!savedDocument) return;

      for (const attachment of attachments.filter((item) => item.remove && item.storage_path)) {
        await supabase.storage.from("service-document-attachments").remove([attachment.storage_path!]);
        await serviceDb.from("service_document_attachments").delete().eq("id", attachment.id);
      }

      const activeAttachments = attachments.filter((item) => !item.remove);
      for (const attachment of activeAttachments) {
        let storagePath = attachment.storage_path;
        if (attachment.file) {
          const extension = attachment.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
          storagePath = `${companyId}/${savedDocument.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("service-document-attachments")
            .upload(storagePath, attachment.file, { contentType: attachment.file.type, upsert: false });
          if (uploadError) throw uploadError;
        }
        if (!storagePath) continue;

        const payload = {
          company_id: companyId,
          service_document_id: savedDocument.id,
          storage_bucket: "service-document-attachments",
          storage_path: storagePath,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          size_bytes: attachment.size_bytes,
          title: attachment.title.trim() || null,
          description: attachment.description.trim() || null,
          sort_order: attachment.sort_order,
          include_in_print: attachment.include_in_print,
          created_by: savedDocument.created_by,
        };

        const { error: attachmentError } = attachment.file
          ? await serviceDb.from("service_document_attachments").insert(payload).select().single()
          : await serviceDb
            .from("service_document_attachments")
            .update({
              title: payload.title,
              description: payload.description,
              sort_order: payload.sort_order,
              include_in_print: payload.include_in_print,
            })
            .eq("id", attachment.id)
            .select()
            .single();
        if (attachmentError) throw attachmentError;
      }
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
