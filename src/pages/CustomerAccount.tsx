import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, CircleDollarSign, Search, WalletCards } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { CountBadge, MetricCard, MetricGrid, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomerAccountCustomers } from "@/features/customer-account/hooks/useCustomerAccountCustomers";
import { useCustomerAccountStatement } from "@/features/customer-account/hooks/useCustomerAccountStatement";
import type { AccountStatementRow, AccountStatementStatus } from "@/features/customer-account/lib/accountStatement";
import { customerIdFromAccountParams } from "@/features/customer-account/lib/routes";
import { formatBusinessDate, todayBusinessDateInputValue } from "@/lib/formatters";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const statusLabels: Record<AccountStatementStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
  payment: "Pago",
};

const statusTone: Record<AccountStatementStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  partial: "info",
  paid: "success",
  overdue: "danger",
  payment: "success",
};

function todayDate() {
  return todayBusinessDateInputValue();
}

export default function CustomerAccountPage() {
  const { currentCompany } = useAuth();
  const [params, setParams] = useSearchParams();
  const [customerId, setCustomerId] = useState(() => customerIdFromAccountParams(params));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayDate());
  const [status, setStatus] = useState<AccountStatementStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);

  const filters = useMemo(() => ({
    customerId: customerId === "all" ? null : customerId,
    from: from || null,
    to: to || null,
    status,
    search,
  }), [customerId, from, search, status, to]);

  const statementQuery = useCustomerAccountStatement(currentCompany?.id, filters);
  const customersQuery = useCustomerAccountCustomers(currentCompany?.id);
  const rows = statementQuery.data?.rows ?? [];
  const pagination = usePaginationSlice({ items: rows, page, pageSize });
  const summary = statementQuery.data?.summary ?? { balance: 0, overdueDebt: 0, notDueDebt: 0, periodPayments: 0, movementsCount: 0 };
  const customers = customersQuery.data ?? [];
  const columns = useMemo<ColumnDef<AccountStatementRow, unknown>[]>(() => [
    { accessorKey: "business_date", header: "Fecha", cell: ({ row }) => formatBusinessDate(row.original.business_date) },
    { accessorKey: "due_date", header: "Vencimiento", cell: ({ row }) => row.original.due_date ? formatBusinessDate(row.original.due_date) : "Sin vencimiento" },
    { accessorKey: "customer_name", header: "Cliente", cell: ({ row }) => <PrimaryCell title={row.original.customer_name ?? "-"} metadata={row.original.origin_label} /> },
    { accessorKey: "reference", header: "Remito / factura / referencia", cell: ({ row }) => row.original.document_id ? <Button asChild variant="link" className="h-auto p-0 text-left"><Link to={`/documents?document_id=${row.original.document_id}`}>{row.original.reference}</Link></Button> : row.original.reference },
    { accessorKey: "description", header: "Descripción", cell: ({ row }) => <PrimaryCell title={row.original.description ?? "-"} /> },
    { accessorKey: "debit", header: () => <div className="text-right">Débito</div>, cell: ({ row }) => row.original.debit > 0 ? <MoneyCell value={row.original.debit} /> : <div className="text-right">-</div> },
    { accessorKey: "credit", header: () => <div className="text-right">Crédito</div>, cell: ({ row }) => row.original.credit > 0 ? <MoneyCell value={row.original.credit} className="text-success" /> : <div className="text-right">-</div> },
    { accessorKey: "running_balance", header: () => <div className="text-right">Saldo</div>, cell: ({ row }) => <MoneyCell value={row.original.running_balance} /> },
    { accessorKey: "status", header: "Estado", cell: ({ row }) => <StatusBadge tone={statusTone[row.original.status]}>{statusLabels[row.original.status]}</StatusBadge> },
  ], []);

  useEffect(() => {
    const nextCustomerId = customerIdFromAccountParams(params);
    setCustomerId((currentCustomerId) => (currentCustomerId === nextCustomerId ? currentCustomerId : nextCustomerId));
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [customerId, from, pageSize, search, status, to]);

  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    const next = new URLSearchParams(params);
    next.delete("customer_id");
    if (value === "all") next.delete("customerId");
    else next.set("customerId", value);
    setParams(next, { replace: true });
  };

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        <PageHeader
          eyebrow="Clientes"
          title="Estado de cuenta"
          description="Vista operativa de deuda, pagos y vencimientos estimados por cliente."
          variant="workspace"
        />

        <FilterToolbar>
          <Select value={customerId} onValueChange={handleCustomerChange}>
            <SelectTrigger className="w-full min-w-[220px] md:w-[260px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full md:w-[160px]" aria-label="Desde" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full md:w-[160px]" aria-label="Hasta" />
          <Select value={status} onValueChange={(value) => setStatus(value as AccountStatementStatus | "all")}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="payment">Pago</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar factura, remito o referencia..." className="pl-9" />
          </div>
        </FilterToolbar>

        <MetricGrid>
          <MetricCard label="Saldo total" value={summary.balance} helper={`${summary.movementsCount} movimientos en el período`} tone="info" icon={<WalletCards className="h-5 w-5" />} />
          <MetricCard
            label="Deuda vencida"
            value={summary.overdueDebt}
            helper="Importes cuyo vencimiento estimado ya pasó."
            tone="danger"
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <MetricCard
            label="Deuda no vencida"
            value={summary.notDueDebt}
            helper="Importes pendientes dentro del plazo estimado."
            tone="warning"
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <MetricCard
            label="Pagos del período"
            value={summary.periodPayments}
            helper="Créditos registrados dentro del rango filtrado."
            tone="success"
            icon={<CircleDollarSign className="h-5 w-5" />}
          />
        </MetricGrid>

        <Card className="min-w-0 border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div><CardTitle>Movimientos de cuenta</CardTitle><CardDescription>Débitos, créditos y saldo acumulado según los filtros aplicados.</CardDescription></div>
            <CountBadge>{summary.movementsCount} {summary.movementsCount === 1 ? "registro" : "registros"}</CountBadge>
          </CardHeader>
          <CardContent>
            {statementQuery.isError ? <p role="alert" className="py-10 text-center text-sm text-destructive">No se pudieron cargar los movimientos. Intentá nuevamente.</p> : (
              <DataTable columns={columns} data={pagination.pagedItems} isLoading={statementQuery.isLoading} emptyMessage="No hay movimientos para mostrar con los filtros actuales." getRowId={(row) => row.id} density="compact" />
            )}
          </CardContent>
        </Card>
        <DataTablePagination
          page={pagination.safePage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(value) => setPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
          itemLabel="movimientos"
        />
      </PageContainer>
    </AppLayout>
  );
}
