import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { AmountDisplay } from "@/components/common/VisualSystem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, formatDocumentNumber } from "@/lib/formatters";
import { canViewBilling } from "@/lib/permissions";
import { useBillingDocumentLines, useBillingDocuments, useBillingRemitoReferences, useBillingSettings } from "@/features/billing/hooks/useBillingData";
import type { BillingDocumentRow } from "@/features/billing/types";

const STATUS_LABEL: Record<BillingDocumentRow["fiscal_status"], string> = {
  DRAFT: "Borrador",
  READY_TO_AUTHORIZE: "Listo para autorizar",
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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const billingAccessContext = { companyRoleCodes, companyPermissionCodes };
  const hasBillingAccess = canViewBilling(roles, billingAccessContext);

  const settingsQuery = useBillingSettings(currentCompany?.id ?? null);
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
                    <Badge variant="outline">Base interna</Badge>
                    <Badge variant="outline">{settingsQuery.billingEnabled ? "Habilitada" : "Feature apagada"}</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Borradores fiscales Factura B Consumidor Final creados desde ventas de Caja con REMITO EMITIDO.
                  </p>
                </div>
              </div>
            </section>

            {!settingsQuery.billingEnabled ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Facturacion interna esta deshabilitada para esta empresa. Activar `billing_settings.is_enabled`
                permite crear borradores, pero esta fase no autoriza CAE ni llama a Afip SDK.
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Card className="border-primary/8 shadow-[var(--shadow-xs)]">
                <CardHeader>
                  <CardTitle>Comprobantes internos</CardTitle>
                  <CardDescription>CAE y numero fiscal quedan vacios hasta una fase de autorizacion.</CardDescription>
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
                                <td className="px-3 py-2 text-right">
                                  <Button
                                    type="button"
                                    variant={selected ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setSelectedDocumentId(document.id)}
                                  >
                                    Ver detalle
                                  </Button>
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
                    Este comprobante todavia no fue autorizado fiscalmente. No tiene CAE.
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
                          <span className="text-muted-foreground">Sin CAE</span>
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
      </div>
    </AppLayout>
  );
}
