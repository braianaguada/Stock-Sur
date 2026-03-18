import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { DOC_LABEL, EMPTY_LINE, INTERNAL_REMITO_LABEL, STATUS_LABEL } from "../constants";
import type {
  CustomerKind,
  DocRow,
  DocStatus,
  DocumentFormState,
  InternalRemitoType,
  LineDraft,
} from "../types";
import { formatNumber } from "../utils";

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

type UseDocumentsMutationsParams = {
  currentCompanyId: string | null;
  userId: string | undefined;
  documents: DocRow[];
  customers: Array<{ id: string; name: string; cuit: string | null }>;
  lines: LineDraft[];
  form: DocumentFormState;
  totalDraft: number;
  editingDocId: string | null;
  priceByItem: Map<string, number>;
  resetDraftForm: () => void;
  setDialogOpen: (open: boolean) => void;
  toast: ToastFn;
};

export function useDocumentsMutations({
  currentCompanyId,
  userId,
  documents,
  customers,
  lines,
  form,
  totalDraft,
  editingDocId,
  priceByItem,
  resetDraftForm,
  setDialogOpen,
  toast,
}: UseDocumentsMutationsParams) {
  const qc = useQueryClient();

  const upsertDraftMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Selecciona una empresa antes de crear documentos");
      const valid = lines.filter((line) => line.description.trim() && line.quantity > 0);
      if (valid.length === 0) throw new Error("Agrega al menos una linea valida");
      if (form.doc_type === "PRESUPUESTO" && form.customer_kind === "INTERNO") {
        throw new Error("Los presupuestos no aplican a personal interno");
      }
      if (form.doc_type === "REMITO" && form.customer_kind === "INTERNO" && !form.internal_remito_type) {
        throw new Error("El remito interno requiere definir si va a cuenta corriente o descuento de sueldo");
      }
      if (form.customer_kind !== "INTERNO" && form.internal_remito_type) {
        throw new Error("El tipo de remito interno solo aplica a remitos del personal interno");
      }

      if (form.price_list_id) {
        const missingItem = valid.some((line) => !line.item_id);
        if (missingItem) throw new Error("Con lista de precios activa, todas las lineas deben tener item");
      }

      const normalizedLines = valid.map((line) => {
        if (!form.price_list_id || !line.item_id) return line;
        if (!priceByItem.has(line.item_id)) {
          throw new Error("Hay items sin precio en la lista seleccionada");
        }
        return { ...line, unit_price: priceByItem.get(line.item_id) ?? 0 };
      });

      const pickedCustomer = form.customer_id ? customers.find((c) => c.id === form.customer_id) : null;
      const customerName = pickedCustomer?.name ?? form.customer_name ?? "Cliente ocasional";
      const customerTaxId = form.customer_tax_id || pickedCustomer?.cuit || null;

      let documentId = editingDocId;
      if (!documentId) {
        const { data: doc, error: docErr } = await supabase
          .from("documents")
          .insert({
            company_id: currentCompanyId!,
            doc_type: form.doc_type,
            status: "BORRADOR",
            point_of_sale: form.point_of_sale,
            customer_id: form.customer_id || null,
            customer_name: customerName || null,
            customer_tax_condition: form.customer_tax_condition || null,
            customer_tax_id: customerTaxId,
            customer_kind: form.customer_kind,
            internal_remito_type: form.doc_type === "REMITO" && form.customer_kind === "INTERNO" ? form.internal_remito_type || null : null,
            payment_terms: form.payment_terms || null,
            delivery_address: form.delivery_address || null,
            salesperson: form.salesperson || null,
            valid_until: form.doc_type === "PRESUPUESTO" ? form.valid_until || null : null,
            price_list_id: form.price_list_id || null,
            notes: form.notes || null,
            subtotal: totalDraft,
            tax_total: 0,
            total: totalDraft,
            created_by: userId,
          })
          .select("id")
          .single();
        if (docErr) throw docErr;
        documentId = doc.id;
      } else {
        const { error: updErr } = await supabase
          .from("documents")
          .update({
            doc_type: form.doc_type,
            point_of_sale: form.point_of_sale,
            customer_id: form.customer_id || null,
            customer_name: customerName || null,
            customer_tax_condition: form.customer_tax_condition || null,
            customer_tax_id: customerTaxId,
            customer_kind: form.customer_kind,
            internal_remito_type: form.doc_type === "REMITO" && form.customer_kind === "INTERNO" ? form.internal_remito_type || null : null,
            payment_terms: form.payment_terms || null,
            delivery_address: form.delivery_address || null,
            salesperson: form.salesperson || null,
            valid_until: form.doc_type === "PRESUPUESTO" ? form.valid_until || null : null,
            price_list_id: form.price_list_id || null,
            notes: form.notes || null,
            subtotal: totalDraft,
            tax_total: 0,
            total: totalDraft,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId)
          .eq("status", "BORRADOR");
        if (updErr) throw updErr;

        const { error: delErr } = await supabase
          .from("document_lines")
          .delete()
          .eq("document_id", documentId);
        if (delErr) throw delErr;
      }

      const payload = normalizedLines.map((line, index) => ({
        document_id: documentId,
        line_order: index + 1,
        item_id: line.item_id,
        sku_snapshot: line.sku_snapshot || null,
        description: line.description,
        unit: line.unit || null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.quantity * line.unit_price,
        created_by: userId,
      }));
      const { error: lineErr } = await supabase.from("document_lines").insert(payload);
      if (lineErr) throw lineErr;

      await supabase.from("document_events").insert({
        document_id: documentId,
        event_type: editingDocId ? "UPDATED" : "CREATED",
        payload: { source: "ui" },
        created_by: userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      setDialogOpen(false);
      resetDraftForm();
      toast({ title: editingDocId ? "Borrador actualizado" : "Borrador guardado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const issueMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const currentDocument = documents.find((row) => row.id === documentId);
      if (currentDocument?.doc_type !== "REMITO") {
        throw new Error("Solo los remitos se emiten");
      }
      const { data: remitoLines, error: linesError } = await supabase
        .from("document_lines")
        .select("item_id")
        .eq("document_id", documentId);
      if (linesError) throw linesError;
      if ((remitoLines ?? []).some((line) => !line.item_id)) {
        throw new Error("El remito tiene lineas sin item asociado y no se puede emitir");
      }
      const { error } = await supabase.rpc("issue_document", { p_document_id: documentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "Documento emitido" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al emitir",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ documentId, targetStatus }: { documentId: string; targetStatus: DocStatus }) => {
      const { error } = await supabase.rpc("transition_document_status", {
        p_document_id: documentId,
        p_target_status: targetStatus,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: `Documento ${STATUS_LABEL[variables.targetStatus].toLowerCase()}` });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo cambiar el estado",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const cloneAsRemitoMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      if (!currentCompanyId) throw new Error("Selecciona una empresa antes de crear documentos");
      const { data: src, error: srcErr } = await supabase
        .from("documents")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (srcErr) throw srcErr;

      const { data: srcLines, error: lineErr } = await supabase
        .from("document_lines")
        .select("*")
        .eq("document_id", sourceId)
        .order("line_order");
      if (lineErr) throw lineErr;

      if (src.status === "ANULADO") {
        throw new Error("No se puede convertir a remito un presupuesto anulado");
      }
      if (src.status !== "APROBADO") {
        throw new Error("Solo se puede convertir a remito un presupuesto aprobado");
      }
      if ((srcLines ?? []).some((line) => !line.item_id)) {
        throw new Error("El presupuesto tiene lineas sin item asociado. Completa los items antes de convertir a remito");
      }

        const { data: newDoc, error: newDocErr } = await supabase
          .from("documents")
          .insert({
            company_id: currentCompanyId!,
            doc_type: "REMITO",
            status: "BORRADOR",
          point_of_sale: src.point_of_sale,
          customer_id: src.customer_id,
          customer_name: src.customer_name,
          customer_tax_condition: src.customer_tax_condition,
          customer_tax_id: src.customer_tax_id,
          customer_kind: src.customer_kind,
          internal_remito_type: src.internal_remito_type,
          payment_terms: src.payment_terms,
          delivery_address: src.delivery_address,
          salesperson: src.salesperson,
          price_list_id: src.price_list_id,
          source_document_id: src.id,
          source_document_type: src.doc_type,
          source_document_number_snapshot: formatNumber(src.document_number, src.point_of_sale),
          notes: src.notes,
          subtotal: 0,
          tax_total: 0,
          total: 0,
          created_by: userId,
        })
        .select("id")
        .single();
      if (newDocErr) throw newDocErr;

      const linesPayload = (srcLines ?? []).map((line) => ({
        document_id: newDoc.id,
        line_order: line.line_order,
        item_id: line.item_id,
        sku_snapshot: line.sku_snapshot,
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_pct: line.discount_pct,
        line_total: line.line_total,
        created_by: userId,
      }));
      const { error: insErr } = await supabase.from("document_lines").insert(linesPayload);
      if (insErr) throw insErr;

      const remitoNumberLabel = formatNumber(null, src.point_of_sale);
      await supabase.from("document_events").insert([
        {
          document_id: newDoc.id,
          event_type: "CREATED",
          payload: {
            source: "budget_conversion",
            source_document_id: src.id,
            source_doc_type: src.doc_type,
            source_number: formatNumber(src.document_number, src.point_of_sale),
          },
          created_by: userId,
        },
        {
          document_id: src.id,
          event_type: "REMITO_CREATED_FROM_BUDGET",
          payload: {
            target_document_id: newDoc.id,
            target_number: remitoNumberLabel,
            source_number: formatNumber(src.document_number, src.point_of_sale),
          },
          created_by: userId,
        },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Remito borrador creado" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo convertir a remito", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  return {
    upsertDraftMutation,
    issueMutation,
    transitionMutation,
    cloneAsRemitoMutation,
  };
}
