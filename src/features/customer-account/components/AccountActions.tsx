import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerAccountCreditDialog } from "@/features/customers/components/CustomerAccountCreditDialog";
import { useCustomerPaymentTerm } from "../hooks/useCustomerPaymentTerm";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";

type Customer = { id: string; name: string; account_due_days: number };

export function AccountActions({ companyId, customers, selectedCustomerId }: {
  companyId: string; customers: Customer[]; selectedCustomerId: string;
}) {
  const [action, setAction] = useState<"payment" | "term" | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [creditOpen, setCreditOpen] = useState(false);
  const [days, setDays] = useState("30");
  const queryClient = useQueryClient();
  const mutation = useCustomerPaymentTerm(companyId);
  const { toast } = useToast();
  const customer = customers.find((item) => item.id === customerId);
  const choose = (id: string) => {
    setCustomerId(id);
    setDays(String(customers.find((item) => item.id === id)?.account_due_days ?? 30));
  };
  const start = (next: "payment" | "term") => {
    choose(selectedCustomerId === "all" ? "" : selectedCustomerId);
    setAction(next);
  };
  const saveTerm = async () => {
    if (!customer) return;
    try {
      await mutation.mutateAsync({ customerId: customer.id, days });
      toast({ title: "Plazo de pago actualizado" });
      setAction(null);
    } catch (error) {
      toast({ title: "No se pudo actualizar el plazo", description: getErrorMessage(error), variant: "destructive" });
    }
  };
  return <>
    <Button variant="outline" disabled={!customers.length} onClick={() => start("term")}>Plazo de pago</Button>
    <Button disabled={!customers.length} onClick={() => start("payment")}>Registrar pago</Button>
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) setAction(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "term" ? "Plazo de pago del cliente" : "Registrar pago"}</DialogTitle>
          <DialogDescription>{action === "term"
            ? "Se usa para estimar vencimientos sin plazo específico. Los documentos con plazo propio lo conservan."
            : "El pago cancela primero las deudas más antiguas del cliente. No genera un movimiento de caja."}</DialogDescription>
        </DialogHeader>
        <Label htmlFor="account-action-customer">Cliente</Label>
        <Select value={customerId} onValueChange={choose} disabled={mutation.isPending}>
          <SelectTrigger id="account-action-customer"><SelectValue placeholder="Seleccioná un cliente" /></SelectTrigger>
          <SelectContent>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
        {action === "term" && <>
          <Label htmlFor="account-payment-days">Plazo en días (0 = contado)</Label>
          <Input id="account-payment-days" type="number" min="0" max="3650" step="1" value={days} disabled={mutation.isPending} onChange={(event) => setDays(event.target.value)} />
        </>}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>Cancelar</Button>
          <Button disabled={!customer || mutation.isPending} onClick={() => {
            if (action === "term") void saveTerm();
            else { setAction(null); setCreditOpen(true); }
          }}>{mutation.isPending ? "Guardando…" : action === "term" ? "Guardar plazo" : "Continuar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {creditOpen && customer && <CustomerAccountCreditDialog
      key={`${companyId}:${customer.id}`} open companyId={companyId} customerId={customer.id}
      customerName={customer.name} onOpenChange={setCreditOpen} onToast={toast}
      onSuccess={async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["customer-account-statement", companyId] }),
          queryClient.invalidateQueries({ queryKey: ["customer-account-summary", companyId, customer.id] }),
          queryClient.invalidateQueries({ queryKey: ["customer-account-entries", companyId, customer.id] }),
        ]);
      }} />}
  </>;
}
