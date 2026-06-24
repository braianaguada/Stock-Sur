import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Edit3, Eye, Plus, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  cancelSettlement,
  createSettlementDraft,
  fetchSettlementDetail,
  fetchSettlementLines,
  fetchSettlements,
  receiveSettlement,
  saveSettlementDraft,
  submitSettlement,
} from "@/features/settlements/api";
import type { EditableExpenseLine, EditableIncomeLine, SettlementHeaderForm, SettlementStatus } from "@/features/settlements/types";
import {
  EMPTY_SETTLEMENT_TOTALS,
  calculateSettlementTotals,
  createHeaderForm,
  editableLineTotal,
  expenseLineToForm,
  formatSettlementNumber,
  hasSettlementDraftChanges,
  incomeLineToForm,
  isDraftSettlement,
  makeExpenseLineDraft,
  makeIncomeLineDraft,
  settlementStatusLabel,
} from "@/features/settlements/utils";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { currency, formatBusinessDate, formatDateTime } from "@/lib/formatters";
import {
  canCancelSettlements,
  canCreateSettlements,
  canEditSettlements,
  canReceiveSettlements,
  canSubmitSettlements,
  canViewSettlements,
} from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";

const statusTone: Record<SettlementStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  RECEIVED: "outline",
  CANCELLED: "destructive",
};

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

function moneyInput(value: string, onChange: (value: string) => void, disabled: boolean) {
  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="min-w-28 text-right tabular-nums"
    />
  );
}

function readOnlyValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : "Sin dato";
}

function readOnlyDate(value: string | null | undefined) {
  return value ? formatBusinessDate(value) : "Sin dato";
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="min-h-6 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

export default function SettlementsPage() {
  const { roles, currentCompany, companyRoleCodes, companyPermissionCodes, user } = useAuth();
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
  const canSubmit = canSubmitSettlements(roles, accessContext);
  const canReceive = canReceiveSettlements(roles, accessContext);
  const canCancel = canCancelSettlements(roles, accessContext);

  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [headerForm, setHeaderForm] = useState(createHeaderForm());
  const [incomeLines, setIncomeLines] = useState<EditableIncomeLine[]>([]);
  const [expenseLines, setExpenseLines] = useState<EditableExpenseLine[]>([]);
  const [originalHeaderForm, setOriginalHeaderForm] = useState<SettlementHeaderForm | null>(null);
  const [originalIncomeLines, setOriginalIncomeLines] = useState<EditableIncomeLine[]>([]);
  const [originalExpenseLines, setOriginalExpenseLines] = useState<EditableExpenseLine[]>([]);
  const [confirmAction, setConfirmAction] = useState<"submit" | "cancel" | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivedByName, setReceivedByName] = useState("");
  const [detailMode, setDetailMode] = useState<"summary" | "edit">("summary");

  useEffect(() => {
    setSelectedSettlementId(null);
    setHeaderForm(createHeaderForm());
    setIncomeLines([]);
    setExpenseLines([]);
    setOriginalHeaderForm(null);
    setOriginalIncomeLines([]);
    setOriginalExpenseLines([]);
    setConfirmAction(null);
    setReceiveOpen(false);
    setDetailMode("summary");
  }, [companyId]);

  useEffect(() => {
    setHeaderForm(createHeaderForm());
    setIncomeLines([]);
    setExpenseLines([]);
    setOriginalHeaderForm(null);
    setOriginalIncomeLines([]);
    setOriginalExpenseLines([]);
    setConfirmAction(null);
    setReceiveOpen(false);
    setDetailMode("summary");
  }, [selectedSettlementId]);

  const settlementsQuery = useQuery({
    queryKey: queryKeys.settlements.list(companyId),
    enabled: Boolean(companyId && canView),
    queryFn: () => fetchSettlements(companyId!),
  });

  useEffect(() => {
    if (selectedSettlementId || !settlementsQuery.data?.length) return;
    setSelectedSettlementId(settlementsQuery.data[0].id);
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
  const liveTotals = useMemo(() => calculateSettlementTotals(incomeLines, expenseLines), [expenseLines, incomeLines]);
  const persistedTotals = useMemo(() => calculateSettlementTotals(originalIncomeLines, originalExpenseLines), [originalExpenseLines, originalIncomeLines]);
  const displayedTotals = selectedSettlement && isDraftSettlement(selectedSettlement.status) && detailMode === "edit"
    ? liveTotals
    : (selectedSettlement ? persistedTotals : EMPTY_SETTLEMENT_TOTALS);
  const draftHasChanges = useMemo(
    () => hasSettlementDraftChanges(headerForm, incomeLines, expenseLines, originalHeaderForm, originalIncomeLines, originalExpenseLines),
    [expenseLines, headerForm, incomeLines, originalExpenseLines, originalHeaderForm, originalIncomeLines],
  );

  useEffect(() => {
    if (!detailQuery.data) return;
    const nextHeaderForm = createHeaderForm(detailQuery.data);
    setHeaderForm(nextHeaderForm);
    setOriginalHeaderForm(nextHeaderForm);
    setReceivedByName(detailQuery.data.received_by_name ?? user?.email?.split("@")[0] ?? "");
  }, [detailQuery.data, user?.email]);

  useEffect(() => {
    if (!linesQuery.data) return;
    const nextIncomeLines = linesQuery.data.incomeLines.map(incomeLineToForm);
    const nextExpenseLines = linesQuery.data.expenseLines.map(expenseLineToForm);
    setIncomeLines(nextIncomeLines);
    setExpenseLines(nextExpenseLines);
    setOriginalIncomeLines(nextIncomeLines);
    setOriginalExpenseLines(nextExpenseLines);
  }, [linesQuery.data]);

  useEffect(() => {
    if (selectedSettlement && !isDraftSettlement(selectedSettlement.status) && detailMode === "edit") {
      setDetailMode("summary");
    }
  }, [detailMode, selectedSettlement]);

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
    if (incomeLines.some((line) => !line.concept.trim())) throw new Error("Cada ingreso necesita concepto.");
    if (expenseLines.some((line) => !line.detail.trim())) throw new Error("Cada egreso necesita detalle.");

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
      toast({ title: "Borrador creado" });
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
      toast({ title: "Borrador guardado" });
    },
    onError: (error) => toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const workflowMutation = useMutation({
    mutationFn: async (action: "submit" | "cancel" | "receive") => {
      if (!selectedSettlementId) throw new Error("Selecciona una rendicion.");
      if (action === "submit") {
        if (canEdit && draftHasChanges) {
          await persistDraft();
        }
        return submitSettlement(selectedSettlementId);
      }
      if (action === "receive") {
        if (!receivedByName.trim()) throw new Error("Indica quien recibio la rendicion.");
        return receiveSettlement(selectedSettlementId, receivedByName.trim());
      }
      return cancelSettlement(selectedSettlementId);
    },
    onSuccess: async () => {
      await invalidateSettlement();
      setConfirmAction(null);
      setReceiveOpen(false);
      toast({ title: "Rendicion actualizada" });
    },
    onError: (error) => toast({ title: "No se pudo actualizar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const mutationPending = saveMutation.isPending || workflowMutation.isPending;
  const editorLocked = editorBlocked || mutationPending;
  const canEditSelectedDraft = Boolean(selectedSettlement && isDraftSettlement(selectedSettlement.status) && canEdit);
  const editable = Boolean(canEditSelectedDraft && detailMode === "edit" && !editorLocked);
  const summaryHeader = originalHeaderForm ?? (selectedSettlement ? createHeaderForm(selectedSettlement) : createHeaderForm());

  const updateIncomeLine = (lineId: string, patch: Partial<EditableIncomeLine>) => {
    setIncomeLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const updateExpenseLine = (lineId: string, patch: Partial<EditableExpenseLine>) => {
    setExpenseLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const removeIncomeLine = (lineId: string) => setIncomeLines((current) => current.filter((line) => line.id !== lineId));
  const removeExpenseLine = (lineId: string) => setExpenseLines((current) => current.filter((line) => line.id !== lineId));

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
          actions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void invalidateSettlement()} disabled={!companyId || settlementsQuery.isFetching || mutationPending}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
              </Button>
              <Button type="button" onClick={() => createMutation.mutate()} disabled={!companyId || !canCreate || createMutation.isPending || mutationPending}>
                <Plus className="mr-2 h-4 w-4" /> Nueva rendicion
              </Button>
            </div>
          }
        />

        {accessState ? accessState : (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Rendiciones de {currentCompany.name}</CardTitle>
                <CardDescription>Selecciona una rendicion para consultar o completar su detalle.</CardDescription>
              </CardHeader>
              <CardContent>
                {settlementsQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Cargando rendiciones...</div>
                ) : settlementsQuery.error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {getErrorMessage(settlementsQuery.error, "No se pudo cargar el listado.")}
                  </div>
                ) : !settlementsQuery.data?.length ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay rendiciones cargadas.</div>
                ) : (
                  <div className="overflow-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rendicion</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Responsables</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settlementsQuery.data.map((settlement) => (
                          <TableRow
                            key={settlement.id}
                            aria-disabled={mutationPending}
                            className={selectedSettlementId === settlement.id ? "bg-muted/55" : mutationPending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                            onClick={() => {
                              if (!mutationPending) setSelectedSettlementId(settlement.id);
                            }}
                          >
                            <TableCell>
                              <p className="font-medium">{formatSettlementNumber(settlement.settlement_number)}</p>
                              <Badge variant={statusTone[settlement.status]}>{settlementStatusLabel(settlement.status)}</Badge>
                            </TableCell>
                            <TableCell>{formatBusinessDate(settlement.settlement_date)}</TableCell>
                            <TableCell>
                              <p className="max-w-40 truncate">{settlement.prepared_by_name}</p>
                              <p className="max-w-40 truncate text-xs text-muted-foreground">{settlement.received_by_name ?? "Sin recepcion"}</p>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {currency.format(settlement.totals.settlement_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <section className="space-y-5" aria-label="Detalle de la rendicion">
              {editorLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Cargando detalle de la rendicion...
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
                    Selecciona una rendicion para ver el detalle.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <StatCard label="Ingresos" value={currency.format(displayedTotals.income_total)} hint={`Efectivo ${currency.format(displayedTotals.income_cash_total)}`} />
                    <StatCard label="Egresos" value={currency.format(displayedTotals.expense_total)} hint={`Efectivo ${currency.format(displayedTotals.expense_cash_total)}`} tone="warning" />
                    <StatCard label="Total rendicion" value={currency.format(displayedTotals.settlement_total)} hint={`Otros medios neto ${currency.format(displayedTotals.income_other_total - displayedTotals.expense_other_total)}`} tone={displayedTotals.settlement_total < 0 ? "danger" : "success"} />
                  </div>

                  <Card>
                    <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>{detailMode === "edit" ? "Editar rendicion" : "Resumen de rendicion"}</CardTitle>
                        <CardDescription>
                          {formatSettlementNumber(selectedSettlement.settlement_number)} - {settlementStatusLabel(selectedSettlement.status)}
                          {selectedSettlement.received_at ? ` - Recibida ${formatDateTime(selectedSettlement.received_at)}` : ""}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detailMode === "summary" && canEditSelectedDraft ? (
                          <Button type="button" variant="outline" onClick={() => setDetailMode("edit")} disabled={editorLocked}>
                            <Edit3 className="mr-2 h-4 w-4" /> Editar
                          </Button>
                        ) : null}
                        {detailMode === "edit" ? (
                          <>
                            <Button type="button" variant="outline" onClick={() => setDetailMode("summary")} disabled={mutationPending}>
                              <Eye className="mr-2 h-4 w-4" /> Ver resumen
                            </Button>
                            <Button type="button" variant="outline" onClick={() => saveMutation.mutate()} disabled={!editable || !draftHasChanges}>
                              <Save className="mr-2 h-4 w-4" /> Guardar
                            </Button>
                          </>
                        ) : null}
                        <Button type="button" onClick={() => setConfirmAction("submit")} disabled={!isDraftSettlement(selectedSettlement.status) || !canSubmit || editorLocked}>
                          <Send className="mr-2 h-4 w-4" /> Presentar
                        </Button>
                        {canReceive ? (
                          <Button type="button" variant="outline" onClick={() => setReceiveOpen(true)} disabled={selectedSettlement.status !== "SUBMITTED" || editorLocked}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Recibir
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button type="button" variant="destructive" onClick={() => setConfirmAction("cancel")} disabled={selectedSettlement.status === "CANCELLED" || editorLocked}>
                            <Ban className="mr-2 h-4 w-4" /> Anular
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {detailMode === "summary" && draftHasChanges ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                          Hay cambios sin guardar en el editor. Este resumen muestra el ultimo detalle persistido.
                        </div>
                      ) : null}

                      {detailMode === "summary" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <DetailField label="Fecha" value={readOnlyDate(summaryHeader.settlement_date)} />
                          <DetailField label="Preparado por" value={readOnlyValue(summaryHeader.prepared_by_name)} />
                          <DetailField label="Periodo desde" value={readOnlyDate(summaryHeader.period_from)} />
                          <DetailField label="Periodo hasta" value={readOnlyDate(summaryHeader.period_to)} />
                          <div className="md:col-span-2">
                            <DetailField label="Notas" value={readOnlyValue(summaryHeader.notes)} />
                          </div>
                          <DetailField label="Creada" value={formatDateTime(selectedSettlement.created_at)} />
                          <DetailField label="Actualizada" value={formatDateTime(selectedSettlement.updated_at)} />
                          <DetailField label="Recibido por" value={readOnlyValue(selectedSettlement.received_by_name)} />
                          <DetailField label="Fecha recepcion" value={selectedSettlement.received_at ? formatDateTime(selectedSettlement.received_at) : "Sin dato"} />
                          <DetailField label="Cantidad ingresos" value={String(originalIncomeLines.length)} />
                          <DetailField label="Cantidad egresos" value={String(originalExpenseLines.length)} />
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="settlement-date">Fecha</Label>
                            <Input id="settlement-date" type="date" value={headerForm.settlement_date} onChange={(event) => setHeaderForm((current) => ({ ...current, settlement_date: event.target.value }))} disabled={!editable} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="prepared-by">Preparado por</Label>
                            <Input id="prepared-by" value={headerForm.prepared_by_name} onChange={(event) => setHeaderForm((current) => ({ ...current, prepared_by_name: event.target.value }))} disabled={!editable} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="period-from">Periodo desde</Label>
                            <Input id="period-from" type="date" value={headerForm.period_from} onChange={(event) => setHeaderForm((current) => ({ ...current, period_from: event.target.value }))} disabled={!editable} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="period-to">Periodo hasta</Label>
                            <Input id="period-to" type="date" value={headerForm.period_to} onChange={(event) => setHeaderForm((current) => ({ ...current, period_to: event.target.value }))} disabled={!editable} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="notes">Notas</Label>
                            <Textarea id="notes" value={headerForm.notes} onChange={(event) => setHeaderForm((current) => ({ ...current, notes: event.target.value }))} disabled={!editable} rows={3} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle id="settlement-income-title">Ingresos</CardTitle>
                          <Badge variant="secondary">{(detailMode === "summary" ? originalIncomeLines : incomeLines).length}</Badge>
                        </div>
                        <CardDescription>
                          {detailMode === "summary"
                            ? "Dinero recibido incluido en esta rendicion."
                            : "Agrega un ingreso por cada cobro o entrada de dinero."}
                        </CardDescription>
                      </div>
                      {detailMode === "edit" ? (
                        <Button type="button" onClick={() => setIncomeLines((current) => [...current, makeIncomeLineDraft(headerForm.settlement_date)])} disabled={!editable}>
                          <Plus className="mr-2 h-4 w-4" /> Agregar ingreso
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto rounded-lg border" role="region" aria-labelledby="settlement-income-title" tabIndex={0}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>OT</TableHead>
                              <TableHead>Recibo</TableHead>
                              <TableHead>Presupuesto</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Concepto</TableHead>
                              <TableHead className="text-right">Efectivo</TableHead>
                              <TableHead className="text-right">Otros</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(detailMode === "summary" ? originalIncomeLines : incomeLines).length === 0 ? (
                              <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">Sin ingresos cargados.</TableCell></TableRow>
                            ) : (detailMode === "summary" ? originalIncomeLines : incomeLines).map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{detailMode === "edit" ? <Input type="date" value={line.line_date} onChange={(event) => updateIncomeLine(line.id, { line_date: event.target.value })} disabled={!editable} className="min-w-36" /> : readOnlyDate(line.line_date)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.work_order} onChange={(event) => updateIncomeLine(line.id, { work_order: event.target.value })} disabled={!editable} className="min-w-24" /> : readOnlyValue(line.work_order)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.receipt} onChange={(event) => updateIncomeLine(line.id, { receipt: event.target.value })} disabled={!editable} className="min-w-28" /> : readOnlyValue(line.receipt)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.quote} onChange={(event) => updateIncomeLine(line.id, { quote: event.target.value })} disabled={!editable} className="min-w-28" /> : readOnlyValue(line.quote)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.customer_name} onChange={(event) => updateIncomeLine(line.id, { customer_name: event.target.value })} disabled={!editable} className="min-w-40" /> : readOnlyValue(line.customer_name)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.concept} onChange={(event) => updateIncomeLine(line.id, { concept: event.target.value })} disabled={!editable} className="min-w-52" /> : readOnlyValue(line.concept)}</TableCell>
                                <TableCell className={detailMode === "summary" ? "text-right tabular-nums" : undefined}>{detailMode === "edit" ? moneyInput(line.cash_amount, (value) => updateIncomeLine(line.id, { cash_amount: value }), !editable) : currency.format(Number(line.cash_amount || 0))}</TableCell>
                                <TableCell className={detailMode === "summary" ? "text-right tabular-nums" : undefined}>{detailMode === "edit" ? moneyInput(line.other_amount, (value) => updateIncomeLine(line.id, { other_amount: value }), !editable) : currency.format(Number(line.other_amount || 0))}</TableCell>
                                <TableCell className="text-right font-medium tabular-nums">{currency.format(editableLineTotal(line))}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.income_type} onChange={(event) => updateIncomeLine(line.id, { income_type: event.target.value })} disabled={!editable} className="min-w-32" /> : readOnlyValue(line.income_type)}</TableCell>
                                <TableCell className="text-right">
                                  {detailMode === "edit" ? (
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
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.income_total)}</TableCell>
                              <TableCell colSpan={2}>{(detailMode === "summary" ? originalIncomeLines : incomeLines).length} filas</TableCell>
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
                          <Badge variant="secondary">{(detailMode === "summary" ? originalExpenseLines : expenseLines).length}</Badge>
                        </div>
                        <CardDescription>
                          {detailMode === "summary"
                            ? "Dinero pagado incluido en esta rendicion."
                            : "Agrega un egreso por cada pago o salida de dinero."}
                        </CardDescription>
                      </div>
                      {detailMode === "edit" ? (
                        <Button type="button" onClick={() => setExpenseLines((current) => [...current, makeExpenseLineDraft(headerForm.settlement_date)])} disabled={!editable}>
                          <Plus className="mr-2 h-4 w-4" /> Agregar egreso
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto rounded-lg border" role="region" aria-labelledby="settlement-expense-title" tabIndex={0}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Comprobante</TableHead>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Detalle</TableHead>
                              <TableHead>OC</TableHead>
                              <TableHead className="text-right">Efectivo</TableHead>
                              <TableHead className="text-right">Otros</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(detailMode === "summary" ? originalExpenseLines : expenseLines).length === 0 ? (
                              <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Sin egresos cargados.</TableCell></TableRow>
                            ) : (detailMode === "summary" ? originalExpenseLines : expenseLines).map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{detailMode === "edit" ? <Input type="date" value={line.line_date} onChange={(event) => updateExpenseLine(line.id, { line_date: event.target.value })} disabled={!editable} className="min-w-36" /> : readOnlyDate(line.line_date)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.receipt} onChange={(event) => updateExpenseLine(line.id, { receipt: event.target.value })} disabled={!editable} className="min-w-28" /> : readOnlyValue(line.receipt)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.supplier_name} onChange={(event) => updateExpenseLine(line.id, { supplier_name: event.target.value })} disabled={!editable} className="min-w-40" /> : readOnlyValue(line.supplier_name)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.detail} onChange={(event) => updateExpenseLine(line.id, { detail: event.target.value })} disabled={!editable} className="min-w-52" /> : readOnlyValue(line.detail)}</TableCell>
                                <TableCell>{detailMode === "edit" ? <Input value={line.purchase_order} onChange={(event) => updateExpenseLine(line.id, { purchase_order: event.target.value })} disabled={!editable} className="min-w-28" /> : readOnlyValue(line.purchase_order)}</TableCell>
                                <TableCell className={detailMode === "summary" ? "text-right tabular-nums" : undefined}>{detailMode === "edit" ? moneyInput(line.cash_amount, (value) => updateExpenseLine(line.id, { cash_amount: value }), !editable) : currency.format(Number(line.cash_amount || 0))}</TableCell>
                                <TableCell className={detailMode === "summary" ? "text-right tabular-nums" : undefined}>{detailMode === "edit" ? moneyInput(line.other_amount, (value) => updateExpenseLine(line.id, { other_amount: value }), !editable) : currency.format(Number(line.other_amount || 0))}</TableCell>
                                <TableCell className="text-right font-medium tabular-nums">{currency.format(editableLineTotal(line))}</TableCell>
                                <TableCell className="text-right">
                                  {detailMode === "edit" ? (
                                    <Button type="button" size="icon" variant="ghost" onClick={() => removeExpenseLine(line.id)} disabled={!editable} aria-label="Eliminar egreso">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/40 font-semibold">
                              <TableCell colSpan={5}>Subtotal egresos</TableCell>
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.expense_cash_total)}</TableCell>
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.expense_other_total)}</TableCell>
                              <TableCell className="text-right tabular-nums">{currency.format(displayedTotals.expense_total)}</TableCell>
                              <TableCell>{(detailMode === "summary" ? originalExpenseLines : expenseLines).length} filas</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Total rendicion</CardTitle>
                      <CardDescription>Consolidado de ingresos menos egresos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-3">
                        <DetailField label="Total ingresos" value={currency.format(displayedTotals.income_total)} />
                        <DetailField label="Total egresos" value={currency.format(displayedTotals.expense_total)} />
                        <DetailField label="Total rendicion" value={currency.format(displayedTotals.settlement_total)} />
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && !mutationPending && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction === "submit" ? "Presentar rendicion" : "Anular rendicion"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "submit"
                ? "Al presentar se asigna el numero consecutivo y se bloquean los detalles."
                : "La anulacion conserva los datos y la trazabilidad."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              if (confirmAction) workflowMutation.mutate(confirmAction);
            }} disabled={mutationPending}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={receiveOpen} onOpenChange={(open) => {
        if (!mutationPending) setReceiveOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recibir rendicion</DialogTitle>
            <DialogDescription>La recepcion registra nombre y fecha desde la base.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="received-by">Recibido por</Label>
            <Input id="received-by" value={receivedByName} onChange={(event) => setReceivedByName(event.target.value)} disabled={mutationPending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)} disabled={mutationPending}>Cancelar</Button>
            <Button type="button" onClick={() => workflowMutation.mutate("receive")} disabled={mutationPending}>Recibir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
