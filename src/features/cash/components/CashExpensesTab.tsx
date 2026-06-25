import { Ban, ReceiptText } from "lucide-react";
import { TableBadge } from "@/components/common/TableBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountDisplay, CompactBadge, OperationalTableShell } from "@/components/common/VisualSystem";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/formatters";
import {
  CASH_EXPENSE_CATEGORIES,
  CASH_EXPENSE_CATEGORY_LABEL,
  CASH_EXPENSE_KIND_LABEL,
} from "../constants";
import type { CashExpenseCategory, CashExpenseFormState, CashExpenseKind, CashExpenseRow } from "../types";
import { buildCashExpenseSummary } from "../utils";

type CashExpensesTabProps = {
  expenses: CashExpenseRow[];
  expensesLoading: boolean;
  form: CashExpenseFormState;
  onFormChange: (form: CashExpenseFormState) => void;
  onSubmit: () => void;
  onCancelExpense: (expenseId: string) => void;
  canCreateExpense: boolean;
  canCancelExpense: (expense: CashExpenseRow) => boolean;
  createPending: boolean;
  cancelPending: boolean;
  hasClosedClosureForDay: boolean;
};

export function CashExpensesTab({
  expenses,
  expensesLoading,
  form,
  onFormChange,
  onSubmit,
  onCancelExpense,
  canCreateExpense,
  canCancelExpense,
  createPending,
  cancelPending,
  hasClosedClosureForDay,
}: CashExpensesTabProps) {
  const summary = buildCashExpenseSummary(expenses);

  const setField = <K extends keyof CashExpenseFormState>(field: K, value: CashExpenseFormState[K]) => {
    onFormChange({ ...form, [field]: value });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Registrar gasto</CardTitle>
          <CardDescription>Los gastos en caja reducen el efectivo a rendir. Los gastos fuera de caja quedan registrados sin afectar el conteo fisico.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canCreateExpense || hasClosedClosureForDay) return;
              onSubmit();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="expense-business-date">Fecha operativa</Label>
              <Input
                id="expense-business-date"
                type="date"
                value={form.businessDate}
                onChange={(event) => setField("businessDate", event.target.value)}
                disabled={hasClosedClosureForDay}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setField("category", value as CashExpenseCategory)}
                disabled={hasClosedClosureForDay}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CASH_EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CASH_EXPENSE_CATEGORY_LABEL[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-description">Descripcion</Label>
              <Input
                id="expense-description"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="Ej: bolsas, comida, envio"
                disabled={hasClosedClosureForDay}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Monto</Label>
                <Input
                  id="expense-amount"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setField("amount", event.target.value)}
                  placeholder="0,00"
                  disabled={hasClosedClosureForDay}
                />
              </div>
              <div className="space-y-2">
                <Label>Impacto</Label>
                <Select
                  value={form.expenseKind}
                  onValueChange={(value) => setField("expenseKind", value as CashExpenseKind)}
                  disabled={hasClosedClosureForDay}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAJA">{CASH_EXPENSE_KIND_LABEL.CAJA}</SelectItem>
                    <SelectItem value="CUENTA_CORRIENTE">{CASH_EXPENSE_KIND_LABEL.CUENTA_CORRIENTE}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border/60 p-3">
              <Checkbox
                id="expense-has-receipt"
                checked={form.hasReceipt}
                onCheckedChange={(checked) => setField("hasReceipt", checked === true)}
                disabled={hasClosedClosureForDay}
              />
              <Label htmlFor="expense-has-receipt" className="cursor-pointer">Tiene comprobante</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-receipt">Referencia de comprobante</Label>
              <Input
                id="expense-receipt"
                value={form.receiptReference}
                onChange={(event) => setField("receiptReference", event.target.value)}
                placeholder="Ticket, factura o nota interna"
                disabled={!form.hasReceipt || hasClosedClosureForDay}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-notes">Notas</Label>
              <Textarea
                id="expense-notes"
                rows={3}
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                disabled={hasClosedClosureForDay}
              />
            </div>

            {hasClosedClosureForDay ? (
              <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
                La caja de esta fecha esta cerrada. No se pueden registrar gastos.
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={createPending || !canCreateExpense || hasClosedClosureForDay}>
              {createPending ? "Guardando..." : "Registrar gasto"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <OperationalTableShell
        title="Gastos del dia"
        description="Registro operativo de egresos. Los anulados quedan visibles, pero no suman."
        count={expenses.length}
        actions={(
          <CompactBadge tone={hasClosedClosureForDay ? "success" : "warning"}>
            {hasClosedClosureForDay ? "Caja cerrada" : "Caja abierta"}
          </CompactBadge>
        )}
      >
          <div className="mb-4 grid gap-3 rounded-2xl border border-border/55 bg-[hsl(var(--panel))]/34 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total egresos</p>
              <AmountDisplay value={summary.total} size="sm" className="mt-1" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Gastos efectivo</p>
              <AmountDisplay value={summary.cash} size="sm" className="mt-1 text-destructive" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Gastos fuera de caja</p>
              <AmountDisplay value={summary.nonCash} size="sm" className="mt-1" />
            </div>
          </div>
          {expensesLoading ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Cargando gastos...
            </div>
          ) : expenses.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Todavia no hay gastos cargados para esta fecha.
            </div>
          ) : (
            <div className="max-h-[620px] overflow-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Hora</th>
                    <th className="px-3 py-3">Categoria</th>
                    <th className="px-3 py-3">Descripcion</th>
                    <th className="px-3 py-3">Medio</th>
                    <th className="px-3 py-3">Comprobante</th>
                    <th className="px-3 py-3 text-right">Monto</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const cancelled = Boolean(expense.cancelled_at);
                    return (
                      <tr key={expense.id} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-mono text-xs">{formatTime(expense.spent_at)}</td>
                        <td className="px-3 py-3">{CASH_EXPENSE_CATEGORY_LABEL[expense.category]}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-[220px]">
                            <p className="truncate font-medium">{expense.description}</p>
                            {expense.notes ? <p className="truncate text-xs text-muted-foreground">{expense.notes}</p> : null}
                            {cancelled ? <TableBadge tone="danger" className="mt-1">Anulado</TableBadge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <TableBadge tone={expense.expense_kind === "CAJA" ? "danger" : "neutral"}>
                            {CASH_EXPENSE_KIND_LABEL[expense.expense_kind]}
                          </TableBadge>
                        </td>
                        <td className="px-3 py-3">
                          {expense.has_receipt ? (
                            <span className="inline-flex items-center gap-1">
                              <ReceiptText className="h-3.5 w-3.5" />
                              {expense.receipt_reference ?? "Si"}
                            </span>
                          ) : (
                            "No"
                          )}
                        </td>
                        <td className={`px-3 py-3 ${cancelled ? "text-muted-foreground line-through" : ""}`}>
                          <AmountDisplay
                            value={Number(expense.amount_total)}
                            size="sm"
                            className={cancelled ? "text-right text-muted-foreground line-through" : "text-right"}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          {!cancelled ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => onCancelExpense(expense.id)}
                              disabled={cancelPending || !canCancelExpense(expense)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </OperationalTableShell>
    </div>
  );
}
