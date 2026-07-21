import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { CountBadge, MetricCard, MetricGrid } from "@/components/common/VisualSystem";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import {
  createSettlementDraft,
  fetchSettlementDetail,
  fetchSettlementLines,
  fetchSettlements,
  saveSettlementDraft,
} from "@/features/settlements/api";
import type { EditableExpenseLine, EditableIncomeLine, SettlementHeaderForm } from "@/features/settlements/types";
import {
  EMPTY_SETTLEMENT_TOTALS,
  calculateSettlementTotals,
  createHeaderForm,
  editableLineTotal,
  expenseLineToForm,
  hasSettlementDraftChanges,
  incomeLineToForm,
  isDraftSettlement,
  makeExpenseLineDraft,
  makeIncomeLineDraft,
} from "@/features/settlements/utils";
import { buildSettlementPrintHtml } from "@/features/settlements/print";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { currency, formatBusinessDate } from "@/lib/formatters";
import {
  canCreateSettlements,
  canEditSettlements,
  canViewSettlements,
} from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { openPrintWindow } from "@/lib/print";

const SETTLEMENT_LINES_PAGE_SIZE = 10;

type SettlementDraftSnapshot = {
  headerForm: SettlementHeaderForm;
  incomeLines: EditableIncomeLine[];
  expenseLines: EditableExpenseLine[];
};

function cloneDraftSnapshot(snapshot: SettlementDraftSnapshot): SettlementDraftSnapshot {
  return {
    headerForm: { ...snapshot.headerForm },
    incomeLines: snapshot.incomeLines.map((line) => ({ ...line })),
    expenseLines: snapshot.expenseLines.map((line) => ({ ...line })),
  };
}

function moneyInput(value: string, onChange: (value: string) => void, disabled: boolean, required = false, ariaLabel?: string) {
  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required={required}
      aria-required={required}
      aria-label={ariaLabel}
      className="min-w-28 text-right tabular-nums"
    />
  );
}

function readOnlyDate(value: string | null | undefined) {
  return value ? formatBusinessDate(value) : "Sin dato";
}

function isDateInRange(lineDate: string, from: string, to: string) {
  return (!from || lineDate >= from) && (!to || lineDate <= to);
}

export default function SettlementsPage() {
  const { roles, currentCompany, companyRoleCodes, companyPermissionCodes, user } = useAuth();
  const { settings: companySettings } = useCompanyBrand();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id ?? null;
  const accessContext = useMemo(
    () => ({ companyRoleCodes, companyPermissionCodes }),
    [companyPermissionCodes, companyRoleCodes],
  );
  const canView = canViewSettlements(roles, accessContext);
  const canCreate = canCreateSettlements(roles, accessContext);
  const canEdit = canEditSettlements(roles, accessContext);

  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [headerForm, setHeaderForm] = useState(createHeaderForm());
  const [incomeLines, setIncomeLines] = useState<EditableIncomeLine[]>([]);
  const [expenseLines, setExpenseLines] = useState<EditableExpenseLine[]>([]);
  const [originalHeaderForm, setOriginalHeaderForm] = useState<SettlementHeaderForm | null>(null);
  const [originalIncomeLines, setOriginalIncomeLines] = useState<EditableIncomeLine[]>([]);
  const [originalExpenseLines, setOriginalExpenseLines] = useState<EditableExpenseLine[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [printRange, setPrintRange] = useState<"all" | "period" | "custom">("period");
  const [printFrom, setPrintFrom] = useState("");
  const [printTo, setPrintTo] = useState("");
  const [printNote, setPrintNote] = useState("");
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [incomeDraft, setIncomeDraft] = useState(() => makeIncomeLineDraft());
  const [expenseDraft, setExpenseDraft] = useState(() => makeExpenseLineDraft());
  const [pendingDeletion, setPendingDeletion] = useState<{ type: "income" | "expense"; id: string } | null>(null);

  useEffect(() => {
    setSelectedSettlementId(null);
    setHeaderForm(createHeaderForm());
    setIncomeLines([]);
    setExpenseLines([]);
    setOriginalHeaderForm(null);
    setOriginalIncomeLines([]);
    setOriginalExpenseLines([]);
    setFilterFrom("");
    setFilterTo("");
    setPrintOpen(false);
    setIncomePage(1);
    setExpensePage(1);
  }, [companyId]);

  useEffect(() => {
    setHeaderForm(createHeaderForm());
    setIncomeLines([]);
    setExpenseLines([]);
    setOriginalHeaderForm(null);
    setOriginalIncomeLines([]);
    setOriginalExpenseLines([]);
    setFilterFrom("");
    setFilterTo("");
    setPrintOpen(false);
    setIncomePage(1);
    setExpensePage(1);
  }, [selectedSettlementId]);

  const settlementsQuery = useQuery({
    queryKey: queryKeys.settlements.list(companyId),
    enabled: Boolean(companyId && canView),
    queryFn: () => fetchSettlements(companyId!),
  });

  const profileQuery = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.full_name?.trim() ?? "";
    },
  });
  const currentUserName = profileQuery.data
    || String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").trim()
    || user?.email
    || "";

  useEffect(() => {
    if (selectedSettlementId || !settlementsQuery.data?.length) return;
    const activeDraft = settlementsQuery.data.find((settlement) => settlement.status === "DRAFT");
    if (activeDraft) setSelectedSettlementId(activeDraft.id);
  }, [selectedSettlementId, settlementsQuery.data]);

  const detailQuery = useQuery({
    queryKey: queryKeys.settlements.detail(companyId, selectedSettlementId),
    enabled: Boolean(companyId && selectedSettlementId && canView),
    queryFn: () => fetchSettlementDetail(companyId!, selectedSettlementId!),
  });

  const linesQuery = useQuery({
    queryKey: queryKeys.settlements.lines(companyId, selectedSettlementId),
    enabled: Boolean(companyId && selectedSettlementId && canView),
    queryFn: () => fetchSettlementLines(companyId!, selectedSettlementId!),
  });

  const selectedSettlement = detailQuery.data ?? null;
  const editorLoading = Boolean(selectedSettlementId && (detailQuery.isLoading || linesQuery.isLoading));
  const editorError = detailQuery.error ?? linesQuery.error ?? null;
  const editorBlocked = editorLoading || Boolean(editorError);
  const visibleIncomeSource = incomeLines;
  const visibleExpenseSource = expenseLines;
  const visibleIncomeLines = useMemo(
    () => visibleIncomeSource.filter((line) => isDateInRange(line.line_date, filterFrom, filterTo)),
    [filterFrom, filterTo, visibleIncomeSource],
  );
  const visibleExpenseLines = useMemo(
    () => visibleExpenseSource.filter((line) => isDateInRange(line.line_date, filterFrom, filterTo)),
    [filterFrom, filterTo, visibleExpenseSource],
  );
  const incomePagination = usePaginationSlice({
    items: visibleIncomeLines,
    page: incomePage,
    pageSize: SETTLEMENT_LINES_PAGE_SIZE,
  });
  const expensePagination = usePaginationSlice({
    items: visibleExpenseLines,
    page: expensePage,
    pageSize: SETTLEMENT_LINES_PAGE_SIZE,
  });
  const displayedTotals = selectedSettlement
    ? calculateSettlementTotals(visibleIncomeLines, visibleExpenseLines)
    : EMPTY_SETTLEMENT_TOTALS;
  const draftHasChanges = useMemo(
    () => hasSettlementDraftChanges(headerForm, incomeLines, expenseLines, originalHeaderForm, originalIncomeLines, originalExpenseLines),
    [expenseLines, headerForm, incomeLines, originalExpenseLines, originalHeaderForm, originalIncomeLines],
  );

  useEffect(() => {
    if (!detailQuery.data) return;
    const nextHeaderForm = createHeaderForm(detailQuery.data);
    setHeaderForm(nextHeaderForm);
    setOriginalHeaderForm(nextHeaderForm);
  }, [detailQuery.data]);

  useEffect(() => {
    if (!linesQuery.data) return;
    const nextIncomeLines = linesQuery.data.incomeLines.map(incomeLineToForm);
    const nextExpenseLines = linesQuery.data.expenseLines.map(expenseLineToForm);
    setIncomeLines(nextIncomeLines);
    setExpenseLines(nextExpenseLines);
    setOriginalIncomeLines(nextIncomeLines);
    setOriginalExpenseLines(nextExpenseLines);
  }, [linesQuery.data]);

  const invalidateSettlement = async (settlementId = selectedSettlementId) => {
    if (!companyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.list(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.detail(companyId, settlementId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.lines(companyId, settlementId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.totals(companyId, settlementId) }),
    ]);
  };

  const persistDraft = async () => {
    if (!companyId || !selectedSettlementId) throw new Error("Selecciona una rendicion.");
    if (!selectedSettlement || !isDraftSettlement(selectedSettlement.status)) throw new Error("Solo los borradores se pueden modificar.");
    if (!canEdit) throw new Error("No tenes permiso para editar rendiciones.");
    if (editorBlocked) throw new Error("El detalle de la rendicion todavia no esta disponible.");
    if (!headerForm.prepared_by_name.trim()) throw new Error("El responsable de preparacion es obligatorio.");
    if (incomeLines.some((line) => !line.line_date || !line.customer_name.trim() || !line.concept.trim() || !line.cash_amount.trim())) {
      throw new Error("Cada ingreso necesita fecha de cobro, cliente, concepto de pago y efectivo.");
    }
    if (expenseLines.some((line) => !line.line_date || !line.detail.trim() || !line.cash_amount.trim())) {
      throw new Error("Cada egreso necesita fecha, detalle y efectivo.");
    }

    const snapshot = cloneDraftSnapshot({ headerForm, incomeLines, expenseLines });

    await saveSettlementDraft({
      settlementId: selectedSettlementId,
      headerForm: snapshot.headerForm,
      incomeLines: snapshot.incomeLines,
      expenseLines: snapshot.expenseLines,
    });

    return snapshot;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Necesitas una empresa activa.");
      return createSettlementDraft(companyId, currentUserName || undefined);
    },
    onSuccess: async (settlement) => {
      setSelectedSettlementId(settlement.id);
      await invalidateSettlement(settlement.id);
      toast({ title: "Registro listo" });
    },
    onError: (error) => toast({ title: "No se pudo crear", description: getErrorMessage(error), variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: persistDraft,
    onSuccess: async (savedSnapshot) => {
      setOriginalHeaderForm(savedSnapshot.headerForm);
      setOriginalIncomeLines(savedSnapshot.incomeLines);
      setOriginalExpenseLines(savedSnapshot.expenseLines);
      await invalidateSettlement();
    },
    onError: (error) => toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" }),
  });

  useEffect(() => {
    if (selectedSettlementId || !companyId || !canCreate || !canEdit || settlementsQuery.isLoading || createMutation.isPending) return;
    if (settlementsQuery.data && !settlementsQuery.data.some((settlement) => settlement.status === "DRAFT")) {
      createMutation.mutate();
    }
  }, [canCreate, canEdit, companyId, createMutation, selectedSettlementId, settlementsQuery.data, settlementsQuery.isLoading]);

  useEffect(() => {
    if (!draftHasChanges || !selectedSettlement || !isDraftSettlement(selectedSettlement.status) || editorBlocked || saveMutation.isPending) return;
    const validIncomeLines = incomeLines.every((line) => line.line_date && line.customer_name.trim() && line.concept.trim() && line.cash_amount.trim());
    const validExpenseLines = expenseLines.every((line) => line.line_date && line.detail.trim() && line.cash_amount.trim());
    if (!validIncomeLines || !validExpenseLines) return;
    const timeout = window.setTimeout(() => saveMutation.mutate(), 700);
    return () => window.clearTimeout(timeout);
  }, [draftHasChanges, editorBlocked, expenseLines, incomeLines, saveMutation, selectedSettlement]);

  const mutationPending = saveMutation.isPending || createMutation.isPending;
  const editorLocked = editorBlocked || mutationPending;
  const canEditSelectedDraft = Boolean(selectedSettlement && isDraftSettlement(selectedSettlement.status) && canEdit);
  const editable = Boolean(canEditSelectedDraft && !editorLocked);

  const removeIncomeLine = (lineId: string) => setIncomeLines((current) => current.filter((line) => line.id !== lineId));
  const removeExpenseLine = (lineId: string) => setExpenseLines((current) => current.filter((line) => line.id !== lineId));
  const openIncomeDialog = () => {
    setIncomeDraft(makeIncomeLineDraft(headerForm.settlement_date));
    setIncomeDialogOpen(true);
  };
  const openExpenseDialog = () => {
    setExpenseDraft(makeExpenseLineDraft(headerForm.settlement_date));
    setExpenseDialogOpen(true);
  };
  const addIncomeLine = () => {
    if (!incomeDraft.line_date || !incomeDraft.customer_name.trim() || !incomeDraft.concept.trim() || !incomeDraft.cash_amount.trim()) {
      toast({ title: "Faltan datos obligatorios", description: "Completa fecha de cobro, cliente, concepto de pago y efectivo.", variant: "destructive" });
      return;
    }
    setIncomeLines((current) => [...current, incomeDraft]);
    setIncomePage(Math.max(1, Math.ceil((visibleIncomeLines.length + 1) / SETTLEMENT_LINES_PAGE_SIZE)));
    setIncomeDialogOpen(false);
  };
  const addExpenseLine = () => {
    if (!expenseDraft.line_date || !expenseDraft.detail.trim() || !expenseDraft.cash_amount.trim()) {
      toast({ title: "Faltan datos obligatorios", description: "Completa fecha, detalle y efectivo.", variant: "destructive" });
      return;
    }
    setExpenseLines((current) => [...current, expenseDraft]);
    setExpensePage(Math.max(1, Math.ceil((visibleExpenseLines.length + 1) / SETTLEMENT_LINES_PAGE_SIZE)));
    setExpenseDialogOpen(false);
  };
  const confirmDeletion = () => {
    if (!pendingDeletion) return;
    if (pendingDeletion.type === "income") removeIncomeLine(pendingDeletion.id);
    else removeExpenseLine(pendingDeletion.id);
    setPendingDeletion(null);
  };
  const openPrintDialog = () => {
    if (!originalHeaderForm) return;
    setPrintRange(originalHeaderForm.period_from || originalHeaderForm.period_to ? "period" : "all");
    setPrintFrom(originalHeaderForm.period_from);
    setPrintTo(originalHeaderForm.period_to);
    setPrintNote("");
    setPrintOpen(true);
  };

  const printSettlement = () => {
    if (!selectedSettlement || !originalHeaderForm) return;
    const from = printRange === "all" ? "" : printRange === "period" ? originalHeaderForm.period_from : printFrom;
    const to = printRange === "all" ? "" : printRange === "period" ? originalHeaderForm.period_to : printTo;
    const win = openPrintWindow(buildSettlementPrintHtml({
      companyName: currentCompany?.name ?? "Stock Sur",
      companyLogoUrl: companySettings.logo_url,
      settlementNumber: selectedSettlement.settlement_number,
      status: selectedSettlement.status,
      header: originalHeaderForm,
      createdAt: selectedSettlement.created_at,
      incomeLines: originalIncomeLines.filter((line) => isDateInRange(line.line_date, from, to)),
      expenseLines: originalExpenseLines.filter((line) => isDateInRange(line.line_date, from, to)),
      filterFrom: from,
      filterTo: to,
      printNote,
      preparedByName: currentUserName,
    }));
    if (!win) toast({ title: "No se pudo abrir la impresion", description: "Habilita las ventanas emergentes e intenta nuevamente.", variant: "destructive" });
    else setPrintOpen(false);
  };

  const renderAccessState = () => {
    if (!currentCompany) {
      return <CompanyAccessNotice description="Necesitas una empresa activa para operar Rendiciones." />;
    }
    if (!canView) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Sin permiso</CardTitle>
            <CardDescription>Tu rol no tiene permisos para ver rendiciones en esta empresa.</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    return null;
  };

  const accessState = renderAccessState();

  return (
    <AppLayout>
      <PageContainer archetype="analytical" className="page-shell">
        <PageHeader
          eyebrow="Administracion"
          title="Rendiciones"
          subtitle="Carga manual de ingresos y egresos por empresa activa."
          variant="analytical"
        />

        {accessState ? accessState : (
          <div className="space-y-5">
            <section className="space-y-5" aria-label="Detalle de la rendicion">
              {settlementsQuery.error ? (
                <Card>
                  <CardContent className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {getErrorMessage(settlementsQuery.error, "No se pudieron cargar los ingresos y egresos.")}
                  </CardContent>
                </Card>
              ) : editorLoading || createMutation.isPending ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Preparando ingresos y egresos...
                  </CardContent>
                </Card>
              ) : editorError ? (
                <Card>
                  <CardContent className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {getErrorMessage(editorError, "No se pudo cargar el detalle de la rendicion.")}
                  </CardContent>
                </Card>
              ) : !selectedSettlement ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    No hay un registro editable disponible.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <MetricGrid className="xl:grid-cols-3">
                    <MetricCard label="Ingresos" value={displayedTotals.income_total} helper={`Efectivo ${currency.format(displayedTotals.income_cash_total)}`} />
                    <MetricCard label="Egresos" value={displayedTotals.expense_total} helper={`Efectivo ${currency.format(displayedTotals.expense_cash_total)}`} tone="warning" />
                    <MetricCard label="Total a rendir" value={displayedTotals.settlement_total} helper="Ingresos menos egresos" tone={displayedTotals.settlement_total < 0 ? "danger" : "success"} />
                  </MetricGrid>

                  <FilterToolbar className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Button type="button" variant="outline" onClick={openPrintDialog} disabled={editorLocked}>
                      <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                    {saveMutation.isPending ? <p className="text-sm text-muted-foreground">Guardando cambios...</p> : null}
                    <div className="space-y-2">
                      <Label htmlFor="lines-filter-from">Mostrar desde</Label>
                      <Input id="lines-filter-from" type="date" value={filterFrom} onChange={(event) => { setFilterFrom(event.target.value); setIncomePage(1); setExpensePage(1); }} className="md:w-44" disabled={editorLocked} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lines-filter-to">Mostrar hasta</Label>
                      <Input id="lines-filter-to" type="date" value={filterTo} onChange={(event) => { setFilterTo(event.target.value); setIncomePage(1); setExpensePage(1); }} className="md:w-44" disabled={editorLocked} />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => { setFilterFrom(""); setFilterTo(""); setIncomePage(1); setExpensePage(1); }} disabled={editorLocked || (!filterFrom && !filterTo)}>
                      <X className="mr-2 h-4 w-4" /> Limpiar filtro
                    </Button>
                    <p className="text-sm text-muted-foreground md:ml-auto">
                      {visibleIncomeLines.length} ingresos y {visibleExpenseLines.length} egresos visibles
                    </p>
                  </FilterToolbar>

                  <Card>
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle id="settlement-income-title">Ingresos</CardTitle>
                          <CountBadge>{visibleIncomeLines.length}</CountBadge>
                        </div>
                        <CardDescription>
                          Agrega un ingreso por cada cobro o entrada de dinero.
                        </CardDescription>
                      </div>
                      {canEditSelectedDraft ? (
                        <Button type="button" onClick={openIncomeDialog} disabled={!editable}>
                          <Plus className="mr-2 h-4 w-4" /> Nuevo ingreso
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto rounded-lg border" role="region" aria-labelledby="settlement-income-title" tabIndex={0}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>FECHA COBRO</TableHead>
                              <TableHead>OT Nº</TableHead>
                              <TableHead>RECIBO Nº</TableHead>
                              <TableHead>Presupuesto</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>CONCEPTO PAGO</TableHead>
                              <TableHead className="text-right">Efectivo</TableHead>
                              <TableHead className="text-right">TRANSF/TARJ/CHEQ</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleIncomeLines.length === 0 ? (
                              <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">Sin ingresos cargados.</TableCell></TableRow>
                            ) : incomePagination.pagedItems.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{readOnlyDate(line.line_date)}</TableCell>
                                <TableCell>{line.work_order || "-"}</TableCell>
                                <TableCell>{line.receipt || "-"}</TableCell>
                                <TableCell>{line.quote || "-"}</TableCell>
                                <TableCell>{line.customer_name}</TableCell>
                                <TableCell>{line.concept}</TableCell>
                                <TableCell className="text-right tabular-nums">{currency.format(Number(line.cash_amount || 0))}</TableCell>
                                <TableCell className="text-right tabular-nums">{currency.format(Number(line.other_amount || 0))}</TableCell>
                                <TableCell>{line.income_type || "-"}</TableCell>
                                <TableCell className="text-right font-medium tabular-nums">{currency.format(editableLineTotal(line))}</TableCell>
                                <TableCell className="text-right">
                                  {editable ? (
                                    <Button type="button" size="icon" variant="ghost" onClick={() => setPendingDeletion({ type: "income", id: line.id })} disabled={!editable} aria-label="Eliminar ingreso">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/40 font-semibold">
                              <TableCell colSpan={6}>Subtotal ingresos</TableCell>
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.income_cash_total)}</TableCell>
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.income_other_total)}</TableCell>
                              <TableCell />
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.income_total)}</TableCell>
                              <TableCell>{visibleIncomeLines.length} filas</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-3">
                        <DataTablePagination
                          page={incomePagination.page}
                          totalPages={incomePagination.totalPages}
                          totalItems={visibleIncomeLines.length}
                          rangeStart={incomePagination.rangeStart}
                          rangeEnd={incomePagination.rangeEnd}
                          onPageChange={setIncomePage}
                          itemLabel="ingresos"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle id="settlement-expense-title">Egresos</CardTitle>
                          <CountBadge>{visibleExpenseLines.length}</CountBadge>
                        </div>
                        <CardDescription>
                          Agrega un egreso por cada pago o salida de dinero.
                        </CardDescription>
                      </div>
                      {canEditSelectedDraft ? (
                        <Button type="button" onClick={openExpenseDialog} disabled={!editable}>
                          <Plus className="mr-2 h-4 w-4" /> Nuevo egreso
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto rounded-lg border" role="region" aria-labelledby="settlement-expense-title" tabIndex={0}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>FECHA</TableHead>
                              <TableHead>FC Nº</TableHead>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Detalle</TableHead>
                              <TableHead>O/C</TableHead>
                              <TableHead className="text-right">Efectivo</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleExpenseLines.length === 0 ? (
                              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Sin egresos cargados.</TableCell></TableRow>
                            ) : expensePagination.pagedItems.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{readOnlyDate(line.line_date)}</TableCell>
                                <TableCell>{line.receipt || "-"}</TableCell>
                                <TableCell>{line.supplier_name || "-"}</TableCell>
                                <TableCell>{line.detail}</TableCell>
                                <TableCell>{line.purchase_order || "-"}</TableCell>
                                <TableCell className="text-right tabular-nums">{currency.format(Number(line.cash_amount || 0))}</TableCell>
                                <TableCell className="text-right">
                                  {editable ? (
                                    <Button type="button" size="icon" variant="ghost" onClick={() => setPendingDeletion({ type: "expense", id: line.id })} disabled={!editable} aria-label="Eliminar egreso">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/40 font-semibold">
                              <TableCell colSpan={5}>Subtotal egresos</TableCell>
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.expense_total)}</TableCell>
                              <TableCell>{visibleExpenseLines.length} filas</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-3">
                        <DataTablePagination
                          page={expensePagination.page}
                          totalPages={expensePagination.totalPages}
                          totalItems={visibleExpenseLines.length}
                          rangeStart={expensePagination.rangeStart}
                          rangeEnd={expensePagination.rangeEnd}
                          onPageChange={setExpensePage}
                          itemLabel="egresos"
                        />
                      </div>
                    </CardContent>
                  </Card>

                </>
              )}
            </section>
          </div>
        )}
      </PageContainer>

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir rendicion</DialogTitle>
            <DialogDescription>Elegí qué fechas incluir. La impresión usa únicamente información guardada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="print-range">Periodo a imprimir</Label>
              <Select value={printRange} onValueChange={(value: "all" | "period" | "custom") => setPrintRange(value)}>
                <SelectTrigger id="print-range"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fechas</SelectItem>
                  <SelectItem value="period">Periodo de la rendicion</SelectItem>
                  <SelectItem value="custom">Fecha o rango personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {printRange === "period" ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm">
                {originalHeaderForm?.period_from ? formatBusinessDate(originalHeaderForm.period_from) : "Inicio"} a {originalHeaderForm?.period_to ? formatBusinessDate(originalHeaderForm.period_to) : "fin"}
              </p>
            ) : null}
            {printRange === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="print-from">Desde</Label>
                  <Input id="print-from" type="date" value={printFrom} onChange={(event) => setPrintFrom(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="print-to">Hasta</Label>
                  <Input id="print-to" type="date" value={printTo} onChange={(event) => setPrintTo(event.target.value)} />
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="print-note">Nota para la hoja impresa</Label>
              <Textarea
                id="print-note"
                value={printNote}
                onChange={(event) => setPrintNote(event.target.value)}
                placeholder="Observaciones que deben aparecer en la impresión"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPrintOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={printSettlement}>
              <Printer className="mr-2 h-4 w-4" /> Abrir impresión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuevo ingreso</DialogTitle>
            <DialogDescription>Completa los datos del cobro. Los campos marcados son obligatorios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label>Fecha cobro *</Label><Input aria-label="Fecha cobro ingreso" type="date" value={incomeDraft.line_date} onChange={(event) => setIncomeDraft((line) => ({ ...line, line_date: event.target.value }))} /></div>
            <div className="space-y-2"><Label>OT N°</Label><Input aria-label="OT ingreso" value={incomeDraft.work_order} onChange={(event) => setIncomeDraft((line) => ({ ...line, work_order: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Recibo N°</Label><Input aria-label="Recibo ingreso" value={incomeDraft.receipt} onChange={(event) => setIncomeDraft((line) => ({ ...line, receipt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Presupuesto</Label><Input aria-label="Presupuesto ingreso" value={incomeDraft.quote} onChange={(event) => setIncomeDraft((line) => ({ ...line, quote: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Cliente *</Label><Input aria-label="Cliente ingreso" value={incomeDraft.customer_name} onChange={(event) => setIncomeDraft((line) => ({ ...line, customer_name: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Concepto pago *</Label><Input aria-label="Concepto pago ingreso" value={incomeDraft.concept} onChange={(event) => setIncomeDraft((line) => ({ ...line, concept: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Efectivo *</Label>{moneyInput(incomeDraft.cash_amount, (value) => setIncomeDraft((line) => ({ ...line, cash_amount: value })), false, true, "Efectivo ingreso")}</div>
            <div className="space-y-2"><Label>Transf/Tarj/Cheq</Label>{moneyInput(incomeDraft.other_amount, (value) => setIncomeDraft((line) => ({ ...line, other_amount: value })), false, false, "Otros medios ingreso")}</div>
            <div className="space-y-2"><Label>Tipo</Label><Input aria-label="Tipo ingreso" value={incomeDraft.income_type} onChange={(event) => setIncomeDraft((line) => ({ ...line, income_type: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIncomeDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={addIncomeLine}>Agregar ingreso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo egreso</DialogTitle>
            <DialogDescription>Completa los datos del pago. Los campos marcados son obligatorios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Fecha *</Label><Input aria-label="Fecha egreso" type="date" value={expenseDraft.line_date} onChange={(event) => setExpenseDraft((line) => ({ ...line, line_date: event.target.value }))} /></div>
            <div className="space-y-2"><Label>FC N°</Label><Input aria-label="FC egreso" value={expenseDraft.receipt} onChange={(event) => setExpenseDraft((line) => ({ ...line, receipt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Proveedor</Label><Input aria-label="Proveedor egreso" value={expenseDraft.supplier_name} onChange={(event) => setExpenseDraft((line) => ({ ...line, supplier_name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>O/C</Label><Input aria-label="OC egreso" value={expenseDraft.purchase_order} onChange={(event) => setExpenseDraft((line) => ({ ...line, purchase_order: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Detalle *</Label><Input aria-label="Detalle egreso" value={expenseDraft.detail} onChange={(event) => setExpenseDraft((line) => ({ ...line, detail: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Efectivo *</Label>{moneyInput(expenseDraft.cash_amount, (value) => setExpenseDraft((line) => ({ ...line, cash_amount: value })), false, true, "Efectivo egreso")}</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={addExpenseLine}>Agregar egreso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeletion)} onOpenChange={(open) => { if (!open) setPendingDeletion(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fila</AlertDialogTitle>
            <AlertDialogDescription>Esta fila se quitará de la rendición. El cambio se guardará automáticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletion}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
