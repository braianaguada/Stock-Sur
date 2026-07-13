import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onConfirm: (paymentMethod: PaymentMethod) => void;
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

  useEffect(() => {
    if (!open) return;
    setPaymentMethod(document?.external_invoice_status === "ACTIVE" ? "EFECTIVO_FACTURABLE" : "EFECTIVO_REMITO");
  }, [document?.external_invoice_status, open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar en Caja</DialogTitle>
          <DialogDescription>
            El importe, la fecha y el comprobante se toman del remito y no pueden modificarse.
          </DialogDescription>
        </DialogHeader>

        {document ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Remito</p><p className="font-mono font-medium">{formatNumber(document.document_number, document.point_of_sale)}</p></div>
              <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{document.issue_date}</p></div>
              <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{document.customer_name || "Consumidor final"}</p></div>
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-mono font-semibold">${Number(document.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p></div>
            </div>

            {document.external_invoice_status === "ACTIVE" ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                Se registrará como factura {document.external_invoice_number}.
              </p>
            ) : null}

            {isClosedBusinessDate ? (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={() => onConfirm(paymentMethod)} disabled={!document || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
