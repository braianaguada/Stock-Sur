import { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerAccountCreditDialog } from "./CustomerAccountCreditDialog";
import type { Customer } from "@/features/customers/types";
import { useCustomerAccountData } from "@/features/customers/hooks/useCustomerAccountData";

type Props = {
  open: boolean;
  companyId: string | null | undefined;
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  onToast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function CustomerAccountDialog({ open, companyId, customer, onOpenChange, onToast }: Props) {
  const [openCredit, setOpenCredit] = useState(false);
  const { summary, entries, isLoading, refetch } = useCustomerAccountData(companyId, customer?.id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cuenta corriente - {customer?.name ?? "-"}</DialogTitle>
            <DialogDescription>{customer?.cuit ?? "Sin CUIT"}</DialogDescription>
          </DialogHeader>

          {customer?.is_occasional ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>El cliente ocasional no usa cuenta corriente.</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saldo</div>
              <div className="mt-2 text-2xl font-semibold">{money.format(summary?.balance ?? 0)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Movimientos</div>
              <div className="mt-2 text-2xl font-semibold">{summary?.movements_count ?? 0}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ultimo movimiento</div>
              <div className="mt-2 text-sm font-medium">
                {summary?.last_movement_at ? new Date(summary.last_movement_at).toLocaleString("es-AR") : "-"}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refrescar
            </Button>
            <Button onClick={() => setOpenCredit(true)} disabled={customer?.is_occasional}>
              Registrar cobro
            </Button>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Sin movimientos
                    </TableCell>
                  </TableRow>
                ) : null}
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.business_date).toLocaleDateString("es-AR")}</TableCell>
                    <TableCell>
                      <Badge variant={entry.entry_type === "DEBIT" ? "destructive" : "secondary"}>
                        {entry.entry_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.origin_type}</TableCell>
                    <TableCell>{entry.description ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">{money.format(entry.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerAccountCreditDialog
        open={openCredit}
        companyId={companyId}
        customerId={customer?.id ?? null}
        customerName={customer?.name ?? "-"}
        onOpenChange={setOpenCredit}
        onSuccess={refetch}
        onToast={onToast}
      />
    </>
  );
}
