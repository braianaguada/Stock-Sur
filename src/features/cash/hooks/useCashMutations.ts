import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { formatDocumentNumber } from "@/lib/formatters";
import type {
  CashClosureRow,
  CashPendingReceiptState,
  CashSaleFormState,
  CustomerOption,
  PaymentMethod,
  ReceiptKind,
  RemitoOption,
} from "../types";

type MutationDeps = {
  currentCompanyId: string | null;
  businessDate: string;
  customers: CustomerOption[];
  remitos: RemitoOption[];
  closure: CashClosureRow | null;
  closureError: unknown;
  closeNotes: string;
  refreshCash: () => Promise<void>;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onCreateSaleSuccess: () => void;
  onAttachReceiptSuccess: () => void;
};

export function useCashMutations({
  currentCompanyId,
  businessDate,
  customers,
  remitos,
  closure,
  closureError,
  closeNotes,
  refreshCash,
  toast,
  onCreateSaleSuccess,
  onAttachReceiptSuccess,
}: MutationDeps) {
  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const remitosById = useMemo(
    () => new Map(remitos.map((remito) => [remito.id, remito])),
    [remitos],
  );

  const createSaleMutation = useMutation({
    mutationFn: async (form: CashSaleFormState) => {
      if (!currentCompanyId) {
        throw new Error("Selecciona una empresa para registrar la venta");
      }

      const parsedAmount = Number(form.amount.replace(",", "."));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Ingresa un importe valido");
      }

      if (form.receiptKind === "REMITO" && form.selectedRemitoId === "__none__") {
        throw new Error("Selecciona un remito emitido");
      }

      if (form.receiptKind === "FACTURA" && !form.receiptReference.trim()) {
        throw new Error("La factura necesita una referencia o numero");
      }

      if (form.paymentMethod === "CUENTA_CORRIENTE" && form.customerId === "__none__") {
        throw new Error("La cuenta corriente requiere cliente");
      }

      const selectedCustomer = customersById.get(form.customerId);
      const selectedRemito = remitosById.get(form.selectedRemitoId);

      const payload = {
        company_id: currentCompanyId,
        business_date: businessDate,
        amount_total: parsedAmount,
        payment_method: form.paymentMethod as PaymentMethod,
        receipt_kind: form.receiptKind as ReceiptKind,
        customer_id: form.customerId === "__none__" ? selectedRemito?.customer_id ?? null : form.customerId,
        customer_name_snapshot: selectedCustomer?.name ?? selectedRemito?.customer_name ?? "Consumidor final",
        document_id: form.receiptKind === "REMITO" ? selectedRemito?.id ?? null : null,
        receipt_reference:
          form.receiptKind === "PENDIENTE"
            ? null
            : form.receiptKind === "REMITO"
              ? formatDocumentNumber(selectedRemito?.point_of_sale ?? 0, selectedRemito?.document_number ?? null)
              : form.receiptReference.trim() || null,
        notes: form.notes.trim() || null,
      };

      const { error } = await supabase.from("cash_sales").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshCash();
      onCreateSaleSuccess();
      toast({ title: "Venta registrada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo registrar la venta",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const attachReceiptMutation = useMutation({
    mutationFn: async (pendingState: CashPendingReceiptState) => {
      if (!pendingState.selectedSale) throw new Error("Selecciona una venta pendiente");
      if (pendingState.pendingReceiptKind === "PENDIENTE") throw new Error("Debes elegir remito o factura");
      if (pendingState.pendingReceiptKind === "REMITO" && pendingState.pendingRemitoId === "__none__") {
        throw new Error("Selecciona un remito emitido");
      }
      if (pendingState.pendingReceiptKind === "FACTURA" && !pendingState.pendingReceiptReference.trim()) {
        throw new Error("Debes ingresar la referencia de la factura");
      }

      const selectedRemito = remitosById.get(pendingState.pendingRemitoId);

      const { error } = await supabase.rpc("attach_cash_sale_receipt", {
        p_sale_id: pendingState.selectedSale.id,
        p_receipt_kind: pendingState.pendingReceiptKind,
        p_document_id: pendingState.pendingReceiptKind === "REMITO" ? selectedRemito?.id ?? null : null,
        p_receipt_reference:
          pendingState.pendingReceiptKind === "REMITO"
            ? formatDocumentNumber(selectedRemito?.point_of_sale ?? 0, selectedRemito?.document_number ?? null)
            : pendingState.pendingReceiptReference.trim(),
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshCash();
      onAttachReceiptSuccess();
      toast({ title: "Comprobante asociado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo asociar el comprobante",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const cancelSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc("cancel_cash_sale", { p_sale_id: saleId, p_reason: "Venta anulada desde Caja" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshCash();
      toast({ title: "Venta anulada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo anular la venta",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const closeClosureMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Selecciona una empresa para operar caja");
      if (closureError instanceof Error) throw closureError;
      if (!closure) throw new Error("No se encontro el cierre del dia");

      const { error } = await supabase.rpc("close_cash_closure", {
        p_closure_id: closure.id,
        p_counted_cash_total: null,
        p_counted_point_total: null,
        p_counted_transfer_total: null,
        p_notes: closeNotes.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshCash();
      toast({ title: "Caja cerrada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo cerrar la caja",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  return {
    createSaleMutation,
    attachReceiptMutation,
    cancelSaleMutation,
    closeClosureMutation,
  };
}
