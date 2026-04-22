import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";

type Props = {
  open: boolean;
  companyId: string | null | undefined;
  customerId: string | null | undefined;
  customerName: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
  onToast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
};

export function CustomerAccountCreditDialog({
  open,
  companyId,
  customerId,
  customerName,
  onOpenChange,
  onSuccess,
  onToast,
}: Props) {
  const [amount, setAmount] = useState("");
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setAmount("");
    setBusinessDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setNotes("");
  };

  const submit = async () => {
    if (!companyId || !customerId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("register_customer_account_credit_manual", {
        p_company_id: companyId,
        p_customer_id: customerId,
        p_amount: Number(amount),
        p_business_date: businessDate,
        p_description: description || null,
        p_notes: notes || null,
        p_metadata: { source: "customers-ui" },
      });
      if (error) throw error;
      onToast({ title: "Cobro registrado" });
      reset();
      await onSuccess();
      onOpenChange(false);
    } catch (error) {
      onToast({ title: "Error al registrar cobro", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>{customerName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Importe</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha operativa</Label>
            <Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={submit} disabled={isSaving || !amount}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
