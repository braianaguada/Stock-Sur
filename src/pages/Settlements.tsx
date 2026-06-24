import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
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

function moneyInput(value: string, onChange: (value: string) => void, disabled: boolean, required = false) {
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
  }, [selectedSettlementId]);

  const settlementsQuery = useQuery({
    queryKey: queryKeys.settlements.list(companyId),
    enabled: Boolean(companyId && canView),
    queryFn: () => fetchSettlements(companyId!),
  });

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
  const editorLoading = Boolean(selectedSettlementId && (detailQuery.isLoading || linesQuery.isLoading || detailQuery.isFetching || linesQuery.isFetching));
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
      return createSettlementDraft(companyId, user?.email ?? undefined);
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

  const updateIncomeLine = (lineId: string, patch: Partial<EditableIncomeLine>) => {
    setIncomeLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const updateExpenseLine = (lineId: string, patch: Partial<EditableExpenseLine>) => {
    setExpenseLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const removeIncomeLine = (lineId: string) => setIncomeLines((current) => current.filter((line) => line.id !== lineId));
  const removeExpenseLine = (lineId: string) => setExpenseLines((current) => current.filter((line) => line.id !== lineId));
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
      <div className="page-shell">
        <PageHeader
          eyebrow="Administracion"
          title="Rendiciones"
          subtitle="Carga manual de ingresos y egresos por empresa activa."
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
                  <div className="grid gap-3 md:grid-cols-3">
                    <StatCard label="Ingresos" value={currency.format(displayedTotals.income_total)} hint={`Efectivo ${currency.format(displayedTotals.income_cash_total)}`} />
                    <StatCard label="Egresos" value={currency.format(displayedTotals.expense_total)} hint={`Efectivo ${currency.format(displayedTotals.expense_cash_total)}`} tone="warning" />
                    <StatCard label="Total a rendir" value={currency.format(displayedTotals.settlement_total)} hint={`Ingresos menos egresos`} tone={displayedTotals.settlement_total < 0 ? "danger" : "success"} />
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 lg:flex-row lg:items-end">
                    {canEditSelectedDraft ? <>
                      <Button type="button" onClick={() => setIncomeLines((current) => [...current, makeIncomeLineDraft(headerForm.settlement_date)])} disabled={!editable}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo ingreso
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setExpenseLines((current) => [...current, makeExpenseLineDraft(headerForm.settlement_date)])} disabled={!editable}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo egreso
                      </Button>
                    </> : null}
                    <Button type="button" variant="outline" onClick={openPrintDialog} disabled={editorLocked}>
                      <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                    {saveMutation.isPending ? <p className="text-sm text-muted-foreground">Guardando cambios...</p> : null}
                    <div className="space-y-2">
                      <Label htmlFor="lines-filter-from">Mostrar desde</Label>
                      <Input id="lines-filter-from" type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} className="md:w-44" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lines-filter-to">Mostrar hasta</Label>
                      <Input id="lines-filter-to" type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} className="md:w-44" />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => { setFilterFrom(""); setFilterTo(""); }} disabled={!filterFrom && !filterTo}>
                      <X className="mr-2 h-4 w-4" /> Limpiar filtro
                    </Button>
                    <p className="text-sm text-muted-foreground md:ml-auto">
                      {visibleIncomeLines.length} ingresos y {visibleExpenseLines.length} egresos visibles
                    </p>
                  </div>

                  <Card>
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle id="settlement-income-title">Ingresos</CardTitle>
                          <Badge variant="secondary">{visibleIncomeLines.length}</Badge>
                        </div>
                        <CardDescription>
                          Agrega un ingreso por cada cobro o entrada de dinero.
                        </CardDescription>
                      </div>
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
                            ) : visibleIncomeLines.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{editable ? <Input aria-label="Fecha cobro ingreso" type="date" required value={line.line_date} onChange={(event) => updateIncomeLine(line.id, { line_date: event.target.value })} disabled={!editable} className="min-w-36" /> : readOnlyDate(line.line_date)}</TableCell>
                                <TableCell><Input value={line.work_order} onChange={(event) => updateIncomeLine(line.id, { work_order: event.target.value })} disabled={!editable} className="min-w-24" /></TableCell>
                                <TableCell><Input value={line.receipt} onChange={(event) => updateIncomeLine(line.id, { receipt: event.target.value })} disabled={!editable} className="min-w-28" /></TableCell>
                                <TableCell><Input value={line.quote} onChange={(event) => updateIncomeLine(line.id, { quote: event.target.value })} disabled={!editable} className="min-w-28" /></TableCell>
                                <TableCell><Input aria-label="Cliente ingreso" required value={line.customer_name} onChange={(event) => updateIncomeLine(line.id, { customer_name: event.target.value })} disabled={!editable} className="min-w-40" /></TableCell>
                                <TableCell><Input aria-label="Concepto pago ingreso" required value={line.concept} onChange={(event) => updateIncomeLine(line.id, { concept: event.target.value })} disabled={!editable} className="min-w-52" /></TableCell>
                                <TableCell>{moneyInput(line.cash_amount, (value) => updateIncomeLine(line.id, { cash_amount: value }), !editable, true)}</TableCell>
                                <TableCell>{moneyInput(line.other_amount, (value) => updateIncomeLine(line.id, { other_amount: value }), !editable)}</TableCell>
                                <TableCell><Input value={line.income_type} onChange={(event) => updateIncomeLine(line.id, { income_type: event.target.value })} disabled={!editable} className="min-w-32" /></TableCell>
                                <TableCell className="text-right font-medium tabular-nums">{currency.format(editableLineTotal(line))}</TableCell>
                                <TableCell className="text-right">
                                  {editable ? (
                                    <Button type="button" size="icon" variant="ghost" onClick={() => removeIncomeLine(line.id)} disabled={!editable} aria-label="Eliminar ingreso">
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
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle id="settlement-expense-title">Egresos</CardTitle>
                          <Badge variant="secondary">{visibleExpenseLines.length}</Badge>
                        </div>
                        <CardDescription>
                          Agrega un egreso por cada pago o salida de dinero.
                        </CardDescription>
                      </div>
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
                            ) : visibleExpenseLines.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell><Input aria-label="Fecha egreso" type="date" required value={line.line_date} onChange={(event) => updateExpenseLine(line.id, { line_date: event.target.value })} disabled={!editable} className="min-w-36" /></TableCell>
                                <TableCell><Input value={line.receipt} onChange={(event) => updateExpenseLine(line.id, { receipt: event.target.value })} disabled={!editable} className="min-w-28" /></TableCell>
                                <TableCell><Input value={line.supplier_name} onChange={(event) => updateExpenseLine(line.id, { supplier_name: event.target.value })} disabled={!editable} className="min-w-40" /></TableCell>
                                <TableCell><Input aria-label="Detalle egreso" required value={line.detail} onChange={(event) => updateExpenseLine(line.id, { detail: event.target.value })} disabled={!editable} className="min-w-52" /></TableCell>
                                <TableCell><Input value={line.purchase_order} onChange={(event) => updateExpenseLine(line.id, { purchase_order: event.target.value })} disabled={!editable} className="min-w-28" /></TableCell>
                                <TableCell>{moneyInput(line.cash_amount, (value) => updateExpenseLine(line.id, { cash_amount: value }), !editable, true)}</TableCell>
                                <TableCell className="text-right">
                                  {editable ? (
                                    <Button type="button" size="icon" variant="ghost" onClick={() => removeExpenseLine(line.id)} disabled={!editable} aria-label="Eliminar egreso">
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
                    </CardContent>
                  </Card>

                </>
              )}
            </section>
          </div>
        )}
      </div>

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
    </AppLayout>
  );
}
