import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
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
import { canViewBilling } from "@/lib/permissions";
import { BillingFiscalSettingsSection } from "@/features/billing/components/BillingFiscalSettingsSection";
import { useBillingActions } from "@/features/billing/hooks/useBillingActions";
import { useBillingDocumentLines, useBillingDocuments, useBillingPointsOfSale, useBillingRemitoReferences, useBillingSettings } from "@/features/billing/hooks/useBillingData";
import {
  canShowAuthorizeBillingDocumentAction,
  canShowCreateCreditNoteBAction,
  canShowPrintBillingDocumentAction,
  getBillingDocumentOriginLabel,
  getBillingDocumentTypeLabel,
  hasActiveTotalCreditNoteForInvoice,
} from "@/features/billing/lib/authorization";
import { canShowBillingSettingsToggle } from "@/features/billing/lib/settings";
import type { BillingDocumentRow } from "@/features/billing/types";

const STATUS_LABEL: Record<BillingDocumentRow["fiscal_status"], string> = {
  DRAFT: "Borrador",
  READY_TO_AUTHORIZE: "Listo para autorizar",
  AUTHORIZING: "Autorizando",
  AUTHORIZED: "Autorizado",
  REJECTED: "Rechazado",
  CANCELLED_INTERNAL: "Cancelado interno",
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
  const billingAccessContext = { companyRoleCodes, companyPermissionCodes };
  const hasBillingAccess = canViewBilling(roles, billingAccessContext);
  const canManageSettings = canShowBillingSettingsToggle(roles, billingAccessContext);

  const settingsQuery = useBillingSettings(currentCompany?.id ?? null);
  const {
    enableBillingMutation,
    disableBillingMutation,
    saveBillingSettingsMutation,
    createBillingPointOfSaleMutation,
    createBillingCreditNoteMutation,
    updateBillingPointOfSaleMutation,
    assignBillingDocumentPointOfSaleMutation,
    authorizeBillingDocumentMutation,
  } = useBillingActions({ companyId: currentCompany?.id ?? null });
  const documentsQuery = useBillingDocuments(currentCompany?.id ?? null);
  const pointsOfSaleQuery = useBillingPointsOfSale(currentCompany?.id ?? null);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );
  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId],
  );
  const remitoIds = useMemo(
    () => documents.map((document) => document.source_remito_id).filter((id): id is string => Boolean(id)),
    [documents],
  );
  const remitosQuery = useBillingRemitoReferences(currentCompany?.id ?? null, remitoIds);
  const linesQuery = useBillingDocumentLines(selectedDocument?.id ?? null);
  const billingTogglePending = enableBillingMutation.isPending || disableBillingMutation.isPending;
  const authorizationPending = authorizeBillingDocumentMutation.isPending;
  const creditNotePending = createBillingCreditNoteMutation.isPending;
  const [authorizationPreparing, setAuthorizationPreparing] = useState(false);
  const authorizationBusy = authorizationPending || authorizationPreparing;
  const [selectedPointOfSale, setSelectedPointOfSale] = useState("");
  const enabledPointsOfSale = useMemo(
    () => (pointsOfSaleQuery.data ?? []).filter((point) => point.is_enabled),
    [pointsOfSaleQuery.data],
  );

  useEffect(() => {
    setSelectedPointOfSale(selectedDocument?.point_of_sale ? String(selectedDocument.point_of_sale) : "");
  }, [selectedDocument?.id, selectedDocument?.point_of_sale]);

  const enableBilling = () => {
    enableBillingMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Facturacion interna activada",
          description: "Esta fase no emite CAE ni llama a Afip SDK.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo activar facturacion interna",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  const disableBilling = () => {
    disableBillingMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Facturacion interna desactivada",
          description: "Los borradores existentes se conservan y siguen visibles con permiso de lectura.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo desactivar facturacion interna",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

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

  const scrollToFiscalSettings = () => {
    document.getElementById("billing-fiscal-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const assignPointOfSale = (document: BillingDocumentRow) => {
    assignBillingDocumentPointOfSaleMutation.mutate({
      billingDocumentId: document.id,
      pointOfSale: Number(selectedPointOfSale),
    }, {
      onSuccess: () => {
        toast({
          title: "Punto de venta asignado",
          description: "El borrador fiscal quedo listo para usar ese punto al autorizar.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo asignar el punto de venta",
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
                    <Badge variant="outline">Homologacion AFIPSDK</Badge>
                    <Badge variant="outline">{settingsQuery.billingEnabled ? "Feature activa" : "Feature apagada"}</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Factura B Consumidor Final y Nota de Credito B total desde factura autorizada. Solo ambiente dev/homologacion.
                  </p>
                </div>
              </div>
            </section>

            {!settingsQuery.billingEnabled ? (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">Facturacion interna esta deshabilitada para esta empresa.</p>
                  <p className="mt-1">
                    Activar `billing_settings.is_enabled` permite crear y autorizar comprobantes solo en homologacion AFIPSDK dev.
                  </p>
                  {!canManageSettings ? (
                    <p className="mt-2 text-xs">Necesitas permiso billing.settings o rol admin para activarla.</p>
                  ) : null}
                </div>
                {canManageSettings ? (
                  <Button type="button" onClick={enableBilling} disabled={billingTogglePending}>
                    Activar facturacion interna
                  </Button>
                ) : null}
              </div>
            ) : null}

            {settingsQuery.billingEnabled && canManageSettings ? (
              <div className="flex flex-col gap-3 rounded-xl border border-success/25 bg-success/8 p-4 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-foreground">Facturacion interna activa.</p>
                  <p className="mt-1 text-muted-foreground">
                    La creacion de borradores desde Caja esta habilitada. La autorizacion fiscal llama a Afip SDK solo en ambiente dev.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={disableBilling} disabled={billingTogglePending}>
                  Desactivar facturacion interna
                </Button>
              </div>
            ) : null}

            <BillingFiscalSettingsSection
              settings={settingsQuery.settings}
              pointsOfSale={pointsOfSaleQuery.data ?? []}
              isLoading={settingsQuery.isLoading || pointsOfSaleQuery.isLoading}
              onSaveSettings={(input, callbacks) => saveBillingSettingsMutation.mutate(input, callbacks)}
              onCreatePointOfSale={(input, callbacks) => createBillingPointOfSaleMutation.mutate(input, callbacks)}
              onUpdatePointOfSale={(input, callbacks) => updateBillingPointOfSaleMutation.mutate(input, callbacks)}
              savingSettings={saveBillingSettingsMutation.isPending}
              creatingPointOfSale={createBillingPointOfSaleMutation.isPending}
              updatingPointOfSale={updateBillingPointOfSaleMutation.isPending}
              toast={toast}
              canEdit={canManageSettings}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Card className="border-primary/8 shadow-[var(--shadow-xs)]">
                <CardHeader>
                  <CardTitle>Comprobantes internos</CardTitle>
                  <CardDescription>CAE y numero fiscal se completan al autorizar contra Afip SDK dev.</CardDescription>
                </CardHeader>
                <CardContent>
                  {documentsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Cargando borradores...</p>
                  ) : documents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                      <p className="font-semibold text-foreground">Sin borradores fiscales</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Cuando se creen desde Caja, van a aparecer aca.
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
                          {documents.map((document) => {
                            const remito = document.source_remito_id ? remitosQuery.data?.get(document.source_remito_id) : null;
                            const selected = selectedDocument?.id === document.id;
                            return (
                              <tr key={document.id} className="border-b last:border-b-0">
                                <td className="px-3 py-2">{formatDateTime(document.created_at)}</td>
                                <td className="px-3 py-2">{getBillingDocumentTypeLabel(document)}</td>
                                <td className="px-3 py-2"><Badge variant="outline">{STATUS_LABEL[document.fiscal_status]}</Badge></td>
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
                    {selectedDocument?.fiscal_status === "AUTHORIZED"
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
                        {canManageSettings && ["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"].includes(selectedDocument.fiscal_status) ? (
                          <div className="rounded-lg border bg-muted/25 p-3">
                            <label className="text-xs font-medium text-muted-foreground" htmlFor="billing-document-pos">
                              Punto de venta fiscal
                            </label>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                              <select
                                id="billing-document-pos"
                                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedPointOfSale}
                                onChange={(event) => setSelectedPointOfSale(event.target.value)}
                              >
                                <option value="">Usar unico habilitado</option>
                                {enabledPointsOfSale.map((point) => (
                                  <option key={point.id} value={point.point_of_sale}>
                                    {point.point_of_sale} {point.description ? `- ${point.description}` : ""}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => assignPointOfSale(selectedDocument)}
                                disabled={!selectedPointOfSale || assignBillingDocumentPointOfSaleMutation.isPending}
                              >
                                Guardar POS
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {selectedDocument.error_message ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
                            {selectedDocument.error_message}
                            {canManageSettings && selectedDocument.error_message.includes("punto de venta fiscal configurado") ? (
                              <div className="mt-3">
                                <Button type="button" variant="outline" size="sm" onClick={scrollToFiscalSettings}>
                                  Configurar punto de venta
                                </Button>
                              </div>
                            ) : null}
                            {canManageSettings && selectedDocument.error_message.includes("CUIT emisor") ? (
                              <div className="mt-3">
                                <Button type="button" variant="outline" size="sm" onClick={scrollToFiscalSettings}>
                                  Configurar CUIT emisor
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedDocument.document_kind === "CREDIT_NOTE" ? (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            Esta nota de credito es fiscal. No devuelve stock ni modifica caja/cuenta corriente.
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
      </div>
    </AppLayout>
  );
}
