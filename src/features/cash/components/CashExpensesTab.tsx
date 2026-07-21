import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, ReceiptText } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountDisplay, CountBadge, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
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

  const columns = useMemo<ColumnDef<CashExpenseRow, unknown>[]>(() => [
    {
      accessorKey: "spent_at",
      header: () => "Hora",
      cell: ({ row }) => <span className="font-mono text-xs">{formatTime(row.original.spent_at)}</span>,
    },
    {
      accessorKey: "category",
      header: () => "Categoría",
      cell: ({ row }) => CASH_EXPENSE_CATEGORY_LABEL[row.original.category],
    },
    {
      accessorKey: "description",
      header: () => "Descripción",
      cell: ({ row }) => (
        <PrimaryCell
          title={row.original.description}
          metadata={row.original.cancelled_at ? "Anulado" : row.original.notes}
        />
      ),
    },
    {
      accessorKey: "expense_kind",
      header: () => "Medio",
      cell: ({ row }) => (
        <StatusBadge tone={row.original.cancelled_at ? "danger" : row.original.expense_kind === "CAJA" ? "warning" : "muted"}>
          {row.original.cancelled_at ? "Anulado" : CASH_EXPENSE_KIND_LABEL[row.original.expense_kind]}
        </StatusBadge>
      ),
    },
    {
      id: "receipt",
      header: () => "Comprobante",
      cell: ({ row }) => row.original.has_receipt ? (
        <span className="inline-flex items-center gap-1"><ReceiptText className="h-3.5 w-3.5" />{row.original.receipt_reference ?? "Sí"}</span>
      ) : "No",
    },
    {
      accessorKey: "amount_total",
      header: () => <div className="text-right">Monto</div>,
      cell: ({ row }) => <MoneyCell value={Number(row.original.amount_total)} className={row.original.cancelled_at ? "text-muted-foreground line-through" : undefined} />,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => row.original.cancelled_at ? null : (
        <RowActions>
          <RowActionButton
            label="Anular gasto"
            tone="danger"
            onClick={() => onCancelExpense(row.original.id)}
            disabled={cancelPending || !canCancelExpense(row.original)}
          >
            <Ban className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
    },
  ], [cancelPending, canCancelExpense, onCancelExpense]);

  const setField = <K extends keyof CashExpenseFormState>(field: K, value: CashExpenseFormState[K]) => {
    onFormChange({ ...form, [field]: value });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="border-border/70 shadow-none">
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

      <Card className="min-w-0 border-border/70 shadow-none">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Gastos del día</CardTitle>
            <CardDescription>Registro operativo de egresos. Los anulados quedan visibles, pero no suman.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CountBadge>{expenses.length} {expenses.length === 1 ? "gasto" : "gastos"}</CountBadge>
            <StatusBadge tone={hasClosedClosureForDay ? "success" : "warning"}>
            {hasClosedClosureForDay ? "Caja cerrada" : "Caja abierta"}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
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
          <DataTable
            columns={columns}
            data={expenses}
            isLoading={expensesLoading}
            loadingMessage="Cargando gastos..."
            emptyMessage="Todavía no hay gastos cargados para esta fecha."
          />
        </CardContent>
      </Card>
    </div>
  );
}
