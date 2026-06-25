import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { TableBadge, type TableBadgeTone } from "@/components/common/TableBadge";
import { AmountDisplay } from "@/components/common/VisualSystem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatDocumentNumber } from "@/lib/formatters";
import { canManageBillingSettings, canViewBilling } from "@/lib/permissions";
import { useBillingActions } from "@/features/billing/hooks/useBillingActions";
import { useBillingDocumentLines, useBillingDocuments, useBillingRemitoReferences, useBillingSettings } from "@/features/billing/hooks/useBillingData";
import {
  canShowResetStaleAuthorizationAction,
  canShowAuthorizeBillingDocumentAction,
  canShowCreateCreditNoteBAction,
  canShowPrintBillingDocumentAction,
  getBillingDocumentOriginLabel,
  getBillingDocumentTypeLabel,
  hasActiveTotalCreditNoteForInvoice,
  isRecentAuthorizingDocument,
} from "@/features/billing/lib/authorization";
import type { BillingDocumentRow } from "@/features/billing/types";

const STATUS_LABEL: Record<BillingDocumentRow["fiscal_status"], string> = {
  DRAFT: "Borrador",
  BLOCKED: "Bloqueado",
  READY_TO_AUTHORIZE: "Listo para autorizar",
  AUTHORIZING: "Autorizando",
  AUTHORIZED: "Autorizado",
  REJECTED: "Rechazado",
  CANCELLED_INTERNAL: "Cancelado interno",
};

const STATUS_TONE: Record<BillingDocumentRow["fiscal_status"], TableBadgeTone> = {
  DRAFT: "neutral",
  BLOCKED: "danger",
  READY_TO_AUTHORIZE: "info",
  AUTHORIZING: "warning",
  AUTHORIZED: "success",
  REJECTED: "danger",
  CANCELLED_INTERNAL: "neutral",
};

function formatRemitoReference(remito?: { point_of_sale: number; document_number: number | null } | null) {
  if (!remito) return "Sin referencia";
  return formatDocumentNumber(remito.point_of_sale, remito.document_number);
}

export default function BillingPage() {
  const { roles, currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
  const { toast } = useToast();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [authorizeDialogDocument, setAuthorizeDialogDocument] = useState<BillingDocumentRow | null>(null);
  const [creditNoteDialogDocument, setCreditNoteDialogDocument] = useState<BillingDocumentRow | null>(null);
  const [resetDialogDocument, setResetDialogDocument] = useState<BillingDocumentRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<BillingDocumentRow["fiscal_status"] | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<BillingDocumentRow["invoice_type"] | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const billingAccessContext = { companyRoleCodes, companyPermissionCodes };
  const hasBillingAccess = canViewBilling(roles, billingAccessContext);
  const canManageSettings = canManageBillingSettings(roles, billingAccessContext);

  const settingsQuery = useBillingSettings(currentCompany?.id ?? null);
  const {
    createBillingCreditNoteMutation,
    authorizeBillingDocumentMutation,
    resetStaleAuthorizationMutation,
  } = useBillingActions({ companyId: currentCompany?.id ?? null });
  const documentsQuery = useBillingDocuments(currentCompany?.id ?? null);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (statusFilter !== "ALL" && document.fiscal_status !== statusFilter) return false;
      if (typeFilter !== "ALL" && document.invoice_type !== typeFilter) return false;
      if (!normalizedSearch) return true;
      return [
        document.voucher_full_number,
        document.cae,
        document.receiver_name,
        document.source_id,
        document.source_remito_id,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
    });
  }, [documents, search, statusFilter, typeFilter]);
  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );
  const selectedDocument = useMemo(
    () => filteredDocuments.find((document) => document.id === selectedDocumentId) ?? filteredDocuments[0] ?? null,
    [filteredDocuments, selectedDocumentId],
  );
  const remitoIds = useMemo(
    () => documents.map((document) => document.source_remito_id).filter((id): id is string => Boolean(id)),
    [documents],
  );
  const remitosQuery = useBillingRemitoReferences(currentCompany?.id ?? null, remitoIds);
  const linesQuery = useBillingDocumentLines(currentCompany?.id ?? null, selectedDocument?.id ?? null);
  const authorizationPending = authorizeBillingDocumentMutation.isPending;
  const creditNotePending = createBillingCreditNoteMutation.isPending;
  const resetPending = resetStaleAuthorizationMutation.isPending;
  const [authorizationPreparing, setAuthorizationPreparing] = useState(false);
  const authorizationBusy = authorizationPending || authorizationPreparing;
  const summary = useMemo(
    () => ({
      authorized: documents.filter((document) => document.fiscal_status === "AUTHORIZED").length,
      drafts: documents.filter((document) => document.fiscal_status === "DRAFT" || document.fiscal_status === "READY_TO_AUTHORIZE").length,
      rejected: documents.filter((document) => document.fiscal_status === "REJECTED").length,
      creditNotes: documents.filter((document) => document.invoice_type === "NOTA_CREDITO_B").length,
      invoiceADrafts: documents.filter((document) => document.invoice_type === "FACTURA_A").length,
      pending: documents.filter((document) => ["DRAFT", "BLOCKED", "READY_TO_AUTHORIZE", "REJECTED", "AUTHORIZING"].includes(document.fiscal_status)).length,
    }),
    [documents],
  );

  const authorizeDocument = (document: BillingDocumentRow) => {
    void (async () => {
      setAuthorizationPreparing(true);
      try {
        const latestDocuments = await documentsQuery.refetch();
        const latestDocument = latestDocuments.data?.find((candidate) => candidate.id === document.id);
        if (!latestDocument) {
          throw new Error("El comprobante fiscal ya no esta disponible.");
        }
        if (!canShowAuthorizeBillingDocumentAction(latestDocument, roles, billingAccessContext)) {
          throw new Error(`El comprobante no esta en un estado autorizable. Estado actual: ${STATUS_LABEL[latestDocument.fiscal_status]}.`);
        }
        setAuthorizeDialogDocument(latestDocument);
        authorizeBillingDocumentMutation.mutate({ billingDocumentId: latestDocument.id }, {
          onSuccess: ({ document: authorizedDocument }) => {
            setAuthorizeDialogDocument(null);
            setSelectedDocumentId(authorizedDocument.id);
            toast({
              title: `${getBillingDocumentTypeLabel(authorizedDocument)} autorizada en homologacion`,
              description: `CAE ${authorizedDocument.cae ?? ""} - ${authorizedDocument.voucher_full_number ?? ""}`,
            });
          },
          onError: (error) => {
            toast({
              title: "No se pudo autorizar el comprobante",
              description: getErrorMessage(error),
              variant: "destructive",
            });
          },
        });
      } catch (error) {
        toast({
          title: "No se pudo autorizar el comprobante",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setAuthorizationPreparing(false);
      }
    })();
  };

  const createCreditNote = (document: BillingDocumentRow) => {
    createBillingCreditNoteMutation.mutate({ billingDocumentId: document.id }, {
      onSuccess: (creditNote) => {
        setCreditNoteDialogDocument(null);
        setSelectedDocumentId(creditNote.id);
        toast({
          title: "Nota de Credito B creada",
          description: "Se creo un borrador total vinculado a la Factura B autorizada.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo crear la Nota de Credito B",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  const openPrint = (document: BillingDocumentRow) => {
    window.open(`/print/billing/${document.id}`, "_blank", "noopener,noreferrer");
  };

  const resetStaleAuthorization = (document: BillingDocumentRow) => {
    resetStaleAuthorizationMutation.mutate({ billingDocumentId: document.id }, {
      onSuccess: () => {
        setResetDialogDocument(null);
        toast({
          title: "Autorizacion liberada",
          description: "El comprobante volvio a borrador para reintento controlado.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo liberar la autorizacion",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para ver borradores fiscales internos." />
        ) : null}

        {currentCompany && !hasBillingAccess ? (
          <CompanyAccessNotice description="No tenes permisos para ver facturacion interna." />
        ) : null}

        {currentCompany && hasBillingAccess ? (
          <>
            <section className="border-b border-border/70 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="page-title">Facturacion</h1>
                    <Badge variant="outline">Homologacion / dev</Badge>
                    <Badge variant="outline">Factura B</Badge>
                    <Badge variant="outline">Factura A borrador</Badge>
                    <Badge variant="outline">NC B total</Badge>
                    <Badge variant="outline">Produccion no habilitada</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Operacion fiscal en homologacion: autorizar B/NC B, imprimir y revisar comprobantes. Factura A esta en preparacion y no emite comprobantes.
                  </p>
                </div>
              </div>
            </section>

            {!settingsQuery.billingEnabled ? (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">Facturacion fiscal no esta configurada.</p>
                  <p className="mt-1">
                    Completa la configuracion en Configuracion &gt; Facturacion fiscal para operar comprobantes.
                  </p>
                  {!canManageSettings ? (
                    <p className="mt-2 text-xs">Necesitas permiso billing.settings para configurarla.</p>
                  ) : null}
                </div>
                {canManageSettings ? (
                  <Button type="button" onClick={() => { window.location.href = "/settings#billing-fiscal-settings"; }}>
                    Configurar facturacion
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Autorizados", summary.authorized],
                ["Borradores", summary.drafts],
                ["Rechazados", summary.rejected],
                ["Notas de credito", summary.creditNotes],
                ["Facturas A borrador", summary.invoiceADrafts],
                ["Pendientes", summary.pending],
              ].map(([label, value]) => (
                <Card key={String(label)} className="border-primary/8 shadow-[var(--shadow-xs)]">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Card className="border-primary/8 shadow-[var(--shadow-xs)]">
                <CardHeader>
                  <CardTitle>Comprobantes fiscales</CardTitle>
                  <CardDescription>CAE y numero fiscal se completan al autorizar contra Afip SDK dev.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por numero, CAE, remito o receptor"
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as BillingDocumentRow["fiscal_status"] | "ALL")}
                    >
                      <option value="ALL">Todos los estados</option>
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value as BillingDocumentRow["invoice_type"] | "ALL")}
                    >
                      <option value="ALL">Todos los tipos</option>
                      <option value="FACTURA_A">Factura A</option>
                      <option value="FACTURA_B">Factura B</option>
                      <option value="NOTA_CREDITO_B">Nota de Credito B</option>
                    </select>
                  </div>
                  {documentsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Cargando borradores...</p>
                  ) : filteredDocuments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                      <p className="font-semibold text-foreground">Todavia no hay comprobantes fiscales</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Crea un borrador desde Caja sobre una venta con remito emitido.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Tipo</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                            <th className="px-3 py-2 text-left">Origen</th>
                            <th className="px-3 py-2 text-left">Remito</th>
                            <th className="px-3 py-2 text-left">Receptor</th>
                            <th className="px-3 py-2 text-right">Total</th>
                            <th className="px-3 py-2 text-left">CAE</th>
                            <th className="px-3 py-2 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDocuments.map((document) => {
                            const remito = document.source_remito_id ? remitosQuery.data?.get(document.source_remito_id) : null;
                            const selected = selectedDocument?.id === document.id;
                            return (
                              <tr key={document.id} className="border-b last:border-b-0">
                                <td className="px-3 py-2">{formatDateTime(document.created_at)}</td>
                                <td className="px-3 py-2">{getBillingDocumentTypeLabel(document)}</td>
                                <td className="px-3 py-2"><TableBadge tone={STATUS_TONE[document.fiscal_status]}>{STATUS_LABEL[document.fiscal_status]}</TableBadge></td>
                                <td className="px-3 py-2">{getBillingDocumentOriginLabel(document)}</td>
                                <td className="px-3 py-2 font-mono text-xs">{formatRemitoReference(remito)}</td>
                                <td className="px-3 py-2">{document.receiver_name}</td>
                                <td className="px-3 py-2 text-right"><AmountDisplay value={Number(document.total)} size="sm" /></td>
                                <td className="px-3 py-2 text-muted-foreground">{document.cae ?? "-"}</td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-end gap-2">
                                    {canShowAuthorizeBillingDocumentAction(document, roles, billingAccessContext) ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAuthorizeDialogDocument(document)}
                                        disabled={authorizationBusy}
                                      >
                                        Autorizar
                                      </Button>
                                    ) : null}
                                    {canShowPrintBillingDocumentAction(document, roles, billingAccessContext) ? (
                                      <Button type="button" variant="outline" size="sm" onClick={() => openPrint(document)}>
                                        Imprimir
                                      </Button>
                                    ) : null}
                                    {canShowResetStaleAuthorizationAction(document, roles, billingAccessContext) ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setResetDialogDocument(document)}
                                        disabled={resetPending}
                                      >
                                        Liberar
                                      </Button>
                                    ) : null}
                                    {canShowCreateCreditNoteBAction(document, documents, roles, billingAccessContext) ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCreditNoteDialogDocument(document)}
                                        disabled={creditNotePending}
                                      >
                                        Crear NC B
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant={selected ? "secondary" : "ghost"}
                                      size="sm"
                                      onClick={() => setSelectedDocumentId(document.id)}
                                    >
                                      Ver detalle
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit border-primary/8 shadow-[var(--shadow-xs)]">
                <CardHeader>
                  <CardTitle>Detalle</CardTitle>
                  <CardDescription>
                    {selectedDocument?.invoice_type === "FACTURA_A"
                      ? "Factura A en preparacion. No emite comprobantes."
                      : selectedDocument?.fiscal_status === "AUTHORIZED"
                      ? "Comprobante autorizado fiscalmente en homologacion."
                      : "Este comprobante todavia no fue autorizado fiscalmente."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedDocument ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Selecciona un borrador.</p>
                  ) : (
                    <div className="space-y-5">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Estado</span>
                          <Badge variant="outline">{STATUS_LABEL[selectedDocument.fiscal_status]}</Badge>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Origen</span>
                          <span>{getBillingDocumentOriginLabel(selectedDocument)}</span>
                        </div>
                        {selectedDocument.related_billing_document_id ? (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Factura asociada</span>
                            <span className="font-mono text-xs">
                              {documentsById.get(selectedDocument.related_billing_document_id)?.voucher_full_number ?? selectedDocument.related_billing_document_id}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Remito</span>
                          <span className="font-mono text-xs">
                            {formatRemitoReference(selectedDocument.source_remito_id ? remitosQuery.data?.get(selectedDocument.source_remito_id) : null)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Receptor</span>
                          <span>{selectedDocument.receiver_name}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">CAE</span>
                          <span className={selectedDocument.cae ? "font-mono text-xs" : "text-muted-foreground"}>
                            {selectedDocument.cae ?? "Sin CAE"}
                          </span>
                        </div>
                        {selectedDocument.voucher_full_number ? (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Numero fiscal</span>
                            <span className="font-mono text-xs">{selectedDocument.voucher_full_number}</span>
                          </div>
                        ) : null}
                        {selectedDocument.error_message ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
                            {selectedDocument.error_message}
                            {canManageSettings && selectedDocument.error_message.includes("punto de venta fiscal configurado") ? (
                              <div className="mt-3">
                                <Button type="button" variant="outline" size="sm" onClick={() => { window.location.href = "/settings#billing-fiscal-settings"; }}>
                                  Configurar punto de venta
                                </Button>
                              </div>
                            ) : null}
                            {canManageSettings && selectedDocument.error_message.includes("CUIT emisor") ? (
                              <div className="mt-3">
                                <Button type="button" variant="outline" size="sm" onClick={() => { window.location.href = "/settings#billing-fiscal-settings"; }}>
                                  Configurar CUIT emisor
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedDocument.fiscal_status === "AUTHORIZING" ? (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            {isRecentAuthorizingDocument(selectedDocument)
                              ? "La autorizacion esta en proceso. Espera unos minutos."
                              : "La autorizacion parece trabada. Se puede liberar para reintento controlado si no tiene CAE ni numero fiscal."}
                          </div>
                        ) : null}
                        {selectedDocument.document_kind === "CREDIT_NOTE" ? (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            Esta nota de credito es fiscal. No devuelve stock ni modifica caja/cuenta corriente.
                          </div>
                        ) : null}
                        {selectedDocument.invoice_type === "FACTURA_A" ? (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            Factura A en preparacion. No emite comprobantes. La autorizacion de Factura A esta bloqueada hasta completar VALIDATED_AUTO real y habilitar la fase correspondiente.
                          </div>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                          {canShowAuthorizeBillingDocumentAction(selectedDocument, roles, billingAccessContext) ? (
                            <Button
                              type="button"
                              onClick={() => setAuthorizeDialogDocument(selectedDocument)}
                              disabled={authorizationBusy}
                            >
                              Autorizar en homologacion
                            </Button>
                          ) : null}
                          {canShowPrintBillingDocumentAction(selectedDocument, roles, billingAccessContext) ? (
                            <Button type="button" variant="outline" onClick={() => openPrint(selectedDocument)}>
                              Imprimir / Guardar PDF
                            </Button>
                          ) : null}
                          {canShowCreateCreditNoteBAction(selectedDocument, documents, roles, billingAccessContext) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCreditNoteDialogDocument(selectedDocument)}
                              disabled={creditNotePending}
                            >
                              Crear Nota de Credito B
                            </Button>
                          ) : null}
                          {canShowResetStaleAuthorizationAction(selectedDocument, roles, billingAccessContext) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setResetDialogDocument(selectedDocument)}
                              disabled={resetPending}
                            >
                              Liberar autorizacion trabada
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border">
                        <div className="border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
                          {selectedDocument.document_kind === "CREDIT_NOTE" ? "Lineas copiadas de la factura original" : "Lineas copiadas del remito"}
                        </div>
                        {linesQuery.isLoading ? (
                          <p className="p-4 text-sm text-muted-foreground">Cargando lineas...</p>
                        ) : (
                          <div className="divide-y">
                            {(linesQuery.data ?? []).map((line) => (
                              <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{line.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {Number(line.quantity)} x ${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <AmountDisplay value={Number(line.total)} size="sm" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 border-t pt-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <AmountDisplay value={Number(selectedDocument.subtotal)} size="sm" />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IVA comercial congelado</span>
                          <AmountDisplay value={Number(selectedDocument.tax_total)} size="sm" />
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <AmountDisplay value={Number(selectedDocument.total)} size="sm" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        <AlertDialog
          open={Boolean(authorizeDialogDocument)}
          onOpenChange={(open) => {
            if (!open && !authorizationBusy) setAuthorizeDialogDocument(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Autorizar {getBillingDocumentTypeLabel(authorizeDialogDocument)} en homologacion</AlertDialogTitle>
              <AlertDialogDescription>
                Se enviara este comprobante a Afip SDK usando ambiente dev para solicitar CAE. No se modifican stock,
                caja ni cuentas corrientes, y no se usa el generador de PDF de Afip SDK.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {authorizeDialogDocument ? (
              <div className="rounded-lg border bg-muted/35 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Receptor</span>
                  <span>{authorizeDialogDocument.receiver_name}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Total</span>
                  <AmountDisplay value={Number(authorizeDialogDocument.total)} size="sm" />
                </div>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={authorizationBusy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={!authorizeDialogDocument || authorizationBusy}
                onClick={(event) => {
                  event.preventDefault();
                  if (authorizeDialogDocument) authorizeDocument(authorizeDialogDocument);
                }}
              >
                {authorizationBusy ? "Autorizando..." : authorizeDialogDocument?.document_kind === "CREDIT_NOTE" ? "Autorizar Nota de Credito B" : "Autorizar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(creditNoteDialogDocument)}
          onOpenChange={(open) => {
            if (!open && !creditNotePending) setCreditNoteDialogDocument(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Crear Nota de Credito B</AlertDialogTitle>
              <AlertDialogDescription>
                Se creara una Nota de Credito B total vinculada a esta Factura B. Esta accion no devuelve stock, no
                modifica caja y no modifica cuenta corriente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {creditNoteDialogDocument ? (
              <div className="rounded-lg border bg-muted/35 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Factura</span>
                  <span className="font-mono text-xs">{creditNoteDialogDocument.voucher_full_number}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Total</span>
                  <AmountDisplay value={Number(creditNoteDialogDocument.total)} size="sm" />
                </div>
                {hasActiveTotalCreditNoteForInvoice(creditNoteDialogDocument, documents) ? (
                  <p className="mt-3 text-xs text-destructive">Ya existe una Nota de Credito B activa para esta factura.</p>
                ) : null}
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={creditNotePending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={!creditNoteDialogDocument || creditNotePending || (creditNoteDialogDocument ? hasActiveTotalCreditNoteForInvoice(creditNoteDialogDocument, documents) : true)}
                onClick={(event) => {
                  event.preventDefault();
                  if (creditNoteDialogDocument) createCreditNote(creditNoteDialogDocument);
                }}
              >
                {creditNotePending ? "Creando..." : "Crear borrador"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(resetDialogDocument)}
          onOpenChange={(open) => {
            if (!open && !resetPending) setResetDialogDocument(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Liberar autorizacion trabada</AlertDialogTitle>
              <AlertDialogDescription>
                Solo se permite para comprobantes AUTHORIZING viejos, sin CAE y sin numero fiscal. Se registra evento
                AUTHORIZATION_RESET y no se modifica stock, caja ni cuenta corriente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {resetDialogDocument ? (
              <div className="rounded-lg border bg-muted/35 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Tipo</span>
                  <span>{getBillingDocumentTypeLabel(resetDialogDocument)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge variant="outline">{STATUS_LABEL[resetDialogDocument.fiscal_status]}</Badge>
                </div>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={!resetDialogDocument || resetPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (resetDialogDocument) resetStaleAuthorization(resetDialogDocument);
                }}
              >
                {resetPending ? "Liberando..." : "Liberar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
