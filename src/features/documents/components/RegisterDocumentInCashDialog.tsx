import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { MoneyCell, PrimaryCell } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_LABEL } from "@/features/cash/constants";
import type { PaymentMethod } from "@/features/cash/types";
import type { DocRow } from "../types";
import { formatNumber } from "../utils";

const PAYMENT_METHODS: PaymentMethod[] = [
  "EFECTIVO_REMITO",
  "EFECTIVO_FACTURABLE",
  "SERVICIOS_REMITO",
  "POINT",
  "TRANSFERENCIA",
  "CUENTA_CORRIENTE",
];

interface RegisterDocumentInCashDialogProps {
  document: DocRow | null;
  open: boolean;
  isSubmitting: boolean;
  isClosedBusinessDate: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paymentMethod: PaymentMethod, externalInvoiceNumber: string) => void;
}

export function RegisterDocumentInCashDialog({
  document,
  open,
  isSubmitting,
  isClosedBusinessDate,
  onOpenChange,
  onConfirm,
}: RegisterDocumentInCashDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO_REMITO");

  const [invoiceNumber, setInvoiceNumber] = useState("");

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(document?.external_invoice_status === "ACTIVE" ? document.external_invoice_number ?? "" : "");
    setPaymentMethod(document?.external_invoice_status === "ACTIVE" ? "EFECTIVO_FACTURABLE" : "EFECTIVO_REMITO");
  }, [document?.id, document?.external_invoice_number, document?.external_invoice_status, open]);

  return (
    <EntityDialog
      open={open}
      onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}
      title="Registrar en Caja"
      contentClassName="max-h-[calc(100dvh-2rem)] sm:max-w-lg"
      bodyClassName="pb-2"
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={() => onConfirm(paymentMethod, invoiceNumber.trim())} disabled={!document || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Registrar
          </Button>
        </>
      )}
    >
      {document ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-2">
            <PrimaryCell title={formatNumber(document.document_number, document.point_of_sale)} metadata="Remito" className="font-mono" />
            <PrimaryCell title={document.issue_date} metadata="Fecha" />
            <PrimaryCell title={document.customer_name || "Consumidor final"} metadata="Cliente" />
            <div><p className="mb-1 text-xs text-muted-foreground">Total</p><MoneyCell value={Number(document.total)} className="text-left" /></div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-invoice-number">Factura A (opcional)</Label>
            <Input id="cash-invoice-number" value={invoiceNumber} disabled={isSubmitting} readOnly={document.external_invoice_status === "ACTIVE"}
              placeholder="Ej. 0009-00001818" onChange={(event) => setInvoiceNumber(event.target.value)} />
          </div>

          {isClosedBusinessDate ? (
            <div className="flex gap-2 rounded-md border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>La fecha operativa ya tiene un cierre. El movimiento quedará posterior al cierre y no lo reabrirá.</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="cash-payment-method">Medio de pago</Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger id="cash-payment-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method} disabled={method === "CUENTA_CORRIENTE" && !document.customer_id}>
                    {PAYMENT_LABEL[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </EntityDialog>
  );
}
