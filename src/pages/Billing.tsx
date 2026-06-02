import { useMemo, useState } from "react";
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
import { useBillingActions } from "@/features/billing/hooks/useBillingActions";
import { useBillingDocumentLines, useBillingDocuments, useBillingRemitoReferences, useBillingSettings } from "@/features/billing/hooks/useBillingData";
import { canShowAuthorizeBillingDocumentAction, canShowPrintBillingDocumentAction } from "@/features/billing/lib/authorization";
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
  const billingAccessContext = { companyRoleCodes, companyPermissionCodes };
  const hasBillingAccess = canViewBilling(roles, billingAccessContext);
  const canManageSettings = canShowBillingSettingsToggle(roles, billingAccessContext);

  const settingsQuery = useBillingSettings(currentCompany?.id ?? null);
  const { enableBillingMutation, disableBillingMutation, authorizeBillingDocumentMutation } = useBillingActions({ companyId: currentCompany?.id ?? null });
  const documentsQuery = useBillingDocuments(currentCompany?.id ?? null);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
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
    authorizeBillingDocumentMutation.mutate({ billingDocumentId: document.id }, {
      onSuccess: ({ document: authorizedDocument }) => {
        setAuthorizeDialogDocument(null);
        setSelectedDocumentId(authorizedDocument.id);
        toast({
          title: "Factura B autorizada en homologacion",
          description: `CAE ${authorizedDocument.cae ?? ""} - ${authorizedDocument.voucher_full_number ?? ""}`,
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo autorizar la factura",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  const openPrint = (document: BillingDocumentRow) => {
    window.open(`/print/billing/${document.id}`, "_blank", "noopener,noreferrer");
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
                    Factura B Consumidor Final desde ventas de Caja con REMITO EMITIDO. Solo ambiente dev/homologacion.
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
                                <td className="px-3 py-2">Factura B</td>
                                <td className="px-3 py-2"><Badge variant="outline">{STATUS_LABEL[document.fiscal_status]}</Badge></td>
                                <td className="px-3 py-2">Caja / Remito</td>
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
                                        disabled={authorizationPending}
                                      >
                                        Autorizar
                                      </Button>
                                    ) : null}
                                    {canShowPrintBillingDocumentAction(document, roles, billingAccessContext) ? (
                                      <Button type="button" variant="outline" size="sm" onClick={() => openPrint(document)}>
                                        Imprimir
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
                          <span>Caja / Remito</span>
                        </div>
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
                          </div>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                          {canShowAuthorizeBillingDocumentAction(selectedDocument, roles, billingAccessContext) ? (
                            <Button
                              type="button"
                              onClick={() => setAuthorizeDialogDocument(selectedDocument)}
                              disabled={authorizationPending}
                            >
                              Autorizar en homologacion
                            </Button>
                          ) : null}
                          {canShowPrintBillingDocumentAction(selectedDocument, roles, billingAccessContext) ? (
                            <Button type="button" variant="outline" onClick={() => openPrint(selectedDocument)}>
                              Imprimir / Guardar PDF
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border">
                        <div className="border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
                          Lineas copiadas del remito
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
            if (!open && !authorizationPending) setAuthorizeDialogDocument(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Autorizar Factura B en homologacion</AlertDialogTitle>
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
              <AlertDialogCancel disabled={authorizationPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={!authorizeDialogDocument || authorizationPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (authorizeDialogDocument) authorizeDocument(authorizeDialogDocument);
                }}
              >
                {authorizationPending ? "Autorizando..." : "Autorizar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
