import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, CircleDollarSign, Search, WalletCards } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { AmountDisplay, MetricCard, MetricGrid, MetricHeroCard, OperationalTableShell } from "@/components/common/VisualSystem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomerAccountStatement } from "@/features/customer-account/hooks/useCustomerAccountStatement";
import type { AccountStatementStatus } from "@/features/customer-account/lib/accountStatement";
import { customerIdFromAccountParams } from "@/features/customer-account/lib/routes";
import { formatBusinessDate, todayBusinessDateInputValue } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const statusLabels: Record<AccountStatementStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
  payment: "Pago",
};

const statusVariant: Record<AccountStatementStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  partial: "default",
  paid: "outline",
  overdue: "destructive",
  payment: "outline",
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
  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(currentCompany?.id ?? null, "account-statement"),
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", currentCompany!.id)
        .eq("is_occasional", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = statementQuery.data?.rows ?? [];
  const pagination = usePaginationSlice({ items: rows, page, pageSize });
  const summary = statementQuery.data?.summary ?? { balance: 0, overdueDebt: 0, notDueDebt: 0, periodPayments: 0, movementsCount: 0 };
  const customers = customersQuery.data ?? [];

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
      <div className="page-shell">
        <PageHeader
          eyebrow="Clientes"
          title="Estado de cuenta"
          description="Vista operativa de deuda, pagos y vencimientos estimados por cliente."
        />

        <FilterBar>
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
        </FilterBar>

        <MetricHeroCard
          label="Saldo total"
          value={summary.balance}
          helper="Balance acumulado de la cuenta según los movimientos registrados."
          breakdown={<span>{summary.movementsCount} movimientos en el período</span>}
          icon={<WalletCards className="h-6 w-6" />}
        />

        <MetricGrid className="xl:grid-cols-3">
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

        <OperationalTableShell
          title="Movimientos de cuenta"
          description="Débitos, créditos y saldo acumulado según los filtros aplicados."
          count={summary.movementsCount}
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Remito / factura / referencia</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      Cargando movimientos...
                    </TableCell>
                  </TableRow>
                ) : null}
                {statementQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-destructive">
                      No se pudieron cargar los movimientos. Intentá nuevamente.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!statementQuery.isLoading && !statementQuery.isError && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      No hay movimientos para mostrar con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : null}
                {pagination.pagedItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatBusinessDate(row.business_date)}</TableCell>
                    <TableCell>{row.due_date ? formatBusinessDate(row.due_date) : "Sin vencimiento"}</TableCell>
                    <TableCell className="font-medium">{row.customer_name ?? "-"}</TableCell>
                    <TableCell>{row.origin_label}</TableCell>
                    <TableCell>
                      {row.document_id ? (
                        <Button asChild variant="link" className="h-auto p-0 text-left">
                          <Link to={`/documents?document_id=${row.document_id}`}>{row.reference}</Link>
                        </Button>
                      ) : row.reference}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{row.description ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {row.debit > 0 ? <AmountDisplay value={row.debit} size="sm" /> : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.credit > 0 ? <AmountDisplay value={row.credit} size="sm" className="text-success" /> : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AmountDisplay value={row.running_balance} size="sm" />
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status]}>{statusLabels[row.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </OperationalTableShell>
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
      </div>
    </AppLayout>
  );
}
