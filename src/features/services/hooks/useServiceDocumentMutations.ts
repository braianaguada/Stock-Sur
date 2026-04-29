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

  const duplicateMutation = useMutation({
    mutationFn: async (sourceDocumentId: string) => {
      if (!companyId) throw new Error("Selecciona una empresa antes de duplicar presupuestos de servicio");

      const { data: document, error: documentError } = await serviceDb
        .from("service_documents")
        .select("*")
        .eq("id", sourceDocumentId)
        .single();
      if (documentError) throw documentError;

      const { data: sourceLines, error: linesError } = await serviceDb
        .from("service_document_lines")
        .select("*")
        .eq("document_id", sourceDocumentId)
        .order("sort_order");
      if (linesError) throw linesError;

      const payload = {
        company_id: companyId,
        customer_id: document.customer_id,
        type: "QUOTE",
        status: "DRAFT",
        reference: document.reference,
        issue_date: new Date().toISOString().slice(0, 10),
        valid_until: null,
        delivery_time: document.delivery_time,
        payment_terms: document.payment_terms,
        delivery_location: document.delivery_location,
        intro_text: document.intro_text,
        closing_text: document.closing_text,
        subtotal: document.subtotal,
        total: document.total,
        currency: document.currency,
        created_by: userId,
      };

      const { data, error } = await serviceDb
        .from("service_documents")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      const duplicatedLines = (sourceLines ?? []).map((line) => ({
        document_id: (data as { id: string }).id,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        line_total: line.line_total,
        sort_order: line.sort_order,
      }));
      const { error: insertLinesError } = await serviceDb.from("service_document_lines").insert(duplicatedLines);
      if (insertLinesError) throw insertLinesError;
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

      const { data: document, error: documentError } = await serviceDb
        .from("service_documents")
        .select("*")
        .eq("id", sourceDocumentId)
        .single();
      if (documentError) throw documentError;

      const { data: sourceLines, error: linesError } = await serviceDb
        .from("service_document_lines")
        .select("*")
        .eq("document_id", sourceDocumentId)
        .order("sort_order");
      if (linesError) throw linesError;

      const payload = {
        company_id: companyId,
        customer_id: document.customer_id,
        type: "REMITO",
        status: "DRAFT",
        reference: document.reference,
        issue_date: new Date().toISOString().slice(0, 10),
        valid_until: null,
        delivery_time: document.delivery_time,
        payment_terms: document.payment_terms,
        delivery_location: document.delivery_location,
        intro_text: document.intro_text,
        closing_text: document.closing_text,
        subtotal: document.subtotal,
        total: document.total,
        currency: document.currency,
        created_by: userId,
      };

      const { data, error } = await serviceDb
        .from("service_documents")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      const duplicatedLines = (sourceLines ?? []).map((line) => ({
        document_id: (data as { id: string }).id,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        line_total: line.line_total,
        sort_order: line.sort_order,
      }));
      const { error: insertLinesError } = await serviceDb.from("service_document_lines").insert(duplicatedLines);
      if (insertLinesError) throw insertLinesError;
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
