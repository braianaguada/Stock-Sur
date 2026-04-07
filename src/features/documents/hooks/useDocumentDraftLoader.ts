import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_LINE } from "../constants";
import type { DocRow, DocumentFormState, LineDraft } from "../types";

type UseDocumentDraftLoaderParams = {
  documentsById: Map<string, DocRow>;
};

type LoadedDocumentDraft = {
  editingDocId: string;
  form: DocumentFormState;
  lines: LineDraft[];
};

export function useDocumentDraftLoader({ documentsById }: UseDocumentDraftLoaderParams) {
  return useCallback(async (docId: string): Promise<LoadedDocumentDraft> => {
    const target = documentsById.get(docId);
    if (!target || target.status !== "BORRADOR") {
      throw new Error("El borrador que intentas editar ya no esta disponible. Recarga Documentos e intenta de nuevo");
    }

    const { data: lineRows, error } = await supabase
      .from("document_lines")
      .select("item_id, sku_snapshot, description, unit, quantity, unit_price, pricing_mode, suggested_unit_price, base_cost_snapshot, list_flete_pct_snapshot, list_utilidad_pct_snapshot, list_impuesto_pct_snapshot, manual_margin_pct, price_overridden_by, price_overridden_at")
      .eq("document_id", docId)
      .order("line_order");

    if (error) {
      throw new Error("No se pudo cargar el borrador");
    }

    const draftLines = (lineRows ?? []).map((line) => ({
      item_id: line.item_id,
      sku_snapshot: line.sku_snapshot ?? "",
      description: line.description,
      unit: line.unit ?? "un",
      quantity: Number(line.quantity) || 0,
      unit_price: Number(line.unit_price) || 0,
      pricing_mode: line.pricing_mode ?? "MANUAL_PRICE",
      suggested_unit_price: Number(line.suggested_unit_price) || Number(line.unit_price) || 0,
      base_cost_snapshot: line.base_cost_snapshot !== null ? Number(line.base_cost_snapshot) : null,
      list_flete_pct_snapshot: line.list_flete_pct_snapshot !== null ? Number(line.list_flete_pct_snapshot) : null,
      list_utilidad_pct_snapshot: line.list_utilidad_pct_snapshot !== null ? Number(line.list_utilidad_pct_snapshot) : null,
      list_impuesto_pct_snapshot: line.list_impuesto_pct_snapshot !== null ? Number(line.list_impuesto_pct_snapshot) : null,
      manual_margin_pct: line.manual_margin_pct !== null ? Number(line.manual_margin_pct) : null,
      price_overridden_by: line.price_overridden_by ?? null,
      price_overridden_at: line.price_overridden_at ?? null,
    }));

    return {
      editingDocId: docId,
      form: {
        doc_type: target.doc_type,
        point_of_sale: target.point_of_sale,
        customer_id: target.customer_id ?? "",
        customer_name: target.customer_name ?? "",
        customer_tax_condition: target.customer_tax_condition ?? "",
        customer_tax_id: target.customer_tax_id ?? "",
        customer_kind: target.customer_kind ?? "GENERAL",
        internal_remito_type: target.internal_remito_type ?? "",
        payment_terms: target.payment_terms ?? "",
        delivery_address: target.delivery_address ?? "",
        salesperson: target.salesperson ?? "",
        valid_until: target.valid_until ?? "",
        price_list_id: target.price_list_id ?? "",
        notes: target.notes ?? "",
      },
      lines: draftLines.length > 0 ? draftLines : [EMPTY_LINE],
    };
  }, [documentsById]);
}
