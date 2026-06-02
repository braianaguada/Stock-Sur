import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { isValidCuitFormat, normalizeCuit } from "../lib/cuit";
import type { BillingPointOfSaleRow, BillingSettingsRow } from "../types";

type ToastFn = (toast: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type BillingFiscalSettingsSectionProps = {
  settings: BillingSettingsRow[];
  pointsOfSale: BillingPointOfSaleRow[];
  isLoading: boolean;
  onSaveSettings: (input: {
    isEnabled: boolean;
    issuerTaxId: string;
    issuerName: string;
    issuerTaxCondition: string;
    notes: string;
  }, callbacks: { onSuccess: () => void; onError: (error: unknown) => void }) => void;
  onCreatePointOfSale: (input: {
    pointOfSale: number;
    description: string;
    isEnabled: boolean;
  }, callbacks: { onSuccess: () => void; onError: (error: unknown) => void }) => void;
  onUpdatePointOfSale: (input: {
    id: string;
    description: string;
    isEnabled: boolean;
  }, callbacks: { onSuccess: () => void; onError: (error: unknown) => void }) => void;
  savingSettings: boolean;
  creatingPointOfSale: boolean;
  updatingPointOfSale: boolean;
  toast: ToastFn;
  canEdit: boolean;
};

type PointForm = Record<string, { description: string; isEnabled: boolean }>;

const CREDENTIALS_LABEL: Record<BillingSettingsRow["credentials_status"], string> = {
  NOT_CONFIGURED: "Pendiente",
  CONFIGURED: "Configuradas",
  ERROR: "Con error",
};

export function BillingFiscalSettingsSection({
  settings,
  pointsOfSale,
  isLoading,
  onSaveSettings,
  onCreatePointOfSale,
  onUpdatePointOfSale,
  savingSettings,
  creatingPointOfSale,
  updatingPointOfSale,
  toast,
  canEdit,
}: BillingFiscalSettingsSectionProps) {
  const devSettings = useMemo(
    () => settings.find((setting) => setting.provider === "AFIPSDK" && setting.environment === "dev") ?? null,
    [settings],
  );
  const [settingsForm, setSettingsForm] = useState({
    isEnabled: false,
    issuerTaxId: "",
    issuerName: "",
    issuerTaxCondition: "",
    notes: "",
  });
  const [newPoint, setNewPoint] = useState({ pointOfSale: "", description: "", isEnabled: true });
  const [pointForms, setPointForms] = useState<PointForm>({});
  const [issuerTaxIdError, setIssuerTaxIdError] = useState("");

  useEffect(() => {
    setSettingsForm({
      isEnabled: Boolean(devSettings?.is_enabled),
      issuerTaxId: devSettings?.issuer_tax_id ?? "",
      issuerName: devSettings?.issuer_name ?? "",
      issuerTaxCondition: devSettings?.issuer_tax_condition ?? "",
      notes: devSettings?.notes ?? "",
    });
  }, [devSettings?.id, devSettings?.is_enabled, devSettings?.issuer_tax_id, devSettings?.issuer_name, devSettings?.issuer_tax_condition, devSettings?.notes]);

  useEffect(() => {
    setPointForms((current) => {
      const next: PointForm = {};
      for (const point of pointsOfSale) {
        next[point.id] = current[point.id] ?? {
          description: point.description ?? "",
          isEnabled: point.is_enabled,
        };
      }
      return next;
    });
  }, [pointsOfSale]);

  const saveSettings = () => {
    const normalizedIssuerTaxId = normalizeCuit(settingsForm.issuerTaxId);
    if (!isValidCuitFormat(settingsForm.issuerTaxId)) {
      setIssuerTaxIdError("El CUIT emisor debe tener 11 dígitos.");
      return;
    }

    setIssuerTaxIdError("");
    onSaveSettings({ ...settingsForm, issuerTaxId: normalizedIssuerTaxId }, {
      onSuccess: () => {
        toast({
          title: "Configuracion fiscal guardada",
          description: "No se guardaron secretos en la base ni en el frontend.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo guardar la configuracion fiscal",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  const createPoint = () => {
    const pointOfSale = Number(newPoint.pointOfSale);
    onCreatePointOfSale({
      pointOfSale,
      description: newPoint.description,
      isEnabled: newPoint.isEnabled,
    }, {
      onSuccess: () => {
        setNewPoint({ pointOfSale: "", description: "", isEnabled: true });
        toast({
          title: "Punto de venta creado",
          description: "Ya queda disponible para autorizacion AFIPSDK dev.",
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo crear el punto de venta",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  const updatePoint = (point: BillingPointOfSaleRow) => {
    const form = pointForms[point.id] ?? { description: "", isEnabled: point.is_enabled };
    onUpdatePointOfSale({
      id: point.id,
      description: form.description,
      isEnabled: form.isEnabled,
    }, {
      onSuccess: () => {
        toast({
          title: "Punto de venta actualizado",
          description: `Punto ${point.point_of_sale} guardado.`,
        });
      },
      onError: (error) => {
        toast({
          title: "No se pudo actualizar el punto de venta",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Card id="billing-fiscal-settings" className="border-primary/8 shadow-[var(--shadow-xs)]">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Configuracion fiscal AFIPSDK dev</CardTitle>
            <CardDescription>
              Datos no secretos y puntos de venta para homologacion. Los tokens y certificados viven en secretos de Supabase.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{settingsForm.isEnabled ? "Interna activa" : "Interna apagada"}</Badge>
            <Badge variant="outline">Provider AFIPSDK</Badge>
            <Badge variant="outline">Ambiente dev</Badge>
            <Badge variant="outline">WSFE</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">Estado credenciales</p>
            <p className="mt-1 font-medium">{CREDENTIALS_LABEL[devSettings?.credentials_status ?? "NOT_CONFIGURED"]}</p>
            <p className="mt-1 text-xs text-muted-foreground">Validacion pendiente por Edge Function.</p>
          </div>
          <div className="rounded-lg border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">Secretos</p>
            <p className="mt-1 font-medium">No visibles</p>
            <p className="mt-1 text-xs text-muted-foreground">Los tokens y certificados no se almacenan aca.</p>
          </div>
          <div className="rounded-lg border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">Alcance</p>
            <p className="mt-1 font-medium">Factura B dev</p>
            <p className="mt-1 text-xs text-muted-foreground">No se habilita produccion desde esta pantalla.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="billing-issuer-tax-id">CUIT emisor</Label>
            <Input
              id="billing-issuer-tax-id"
              value={settingsForm.issuerTaxId}
              onChange={(event) => {
                setIssuerTaxIdError("");
                setSettingsForm((current) => ({ ...current, issuerTaxId: event.target.value }));
              }}
              placeholder="Ingrese CUIT emisor"
              disabled={!canEdit}
            />
            {issuerTaxIdError ? <p className="text-xs text-destructive">{issuerTaxIdError}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-issuer-name">Razon social</Label>
            <Input
              id="billing-issuer-name"
              value={settingsForm.issuerName}
              onChange={(event) => setSettingsForm((current) => ({ ...current, issuerName: event.target.value }))}
              placeholder="Opcional"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-issuer-tax-condition">Condicion IVA</Label>
            <Input
              id="billing-issuer-tax-condition"
              value={settingsForm.issuerTaxCondition}
              onChange={(event) => setSettingsForm((current) => ({ ...current, issuerTaxCondition: event.target.value }))}
              placeholder="Opcional"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-settings-notes">Notas internas</Label>
            <Input
              id="billing-settings-notes"
              value={settingsForm.notes}
              onChange={(event) => setSettingsForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Sin secretos"
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={settingsForm.isEnabled}
              onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, isEnabled: checked === true }))}
              disabled={!canEdit}
            />
            Facturacion interna habilitada
          </label>
          {canEdit ? (
            <Button type="button" onClick={saveSettings} disabled={savingSettings || isLoading}>
              {savingSettings ? "Guardando..." : "Guardar configuracion"}
            </Button>
          ) : null}
        </div>

        {canEdit ? <div className="space-y-3 border-t pt-5">
          <div>
            <h3 className="font-semibold">Puntos de venta</h3>
            <p className="text-sm text-muted-foreground">Cada punto se usa con ambiente dev y afip_ws wsfe.</p>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[140px_minmax(0,1fr)_auto_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="billing-new-pos">Punto</Label>
              <Input
                id="billing-new-pos"
                inputMode="numeric"
                type="number"
                min={1}
                value={newPoint.pointOfSale}
                onChange={(event) => setNewPoint((current) => ({ ...current, pointOfSale: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-new-pos-description">Descripcion</Label>
              <Input
                id="billing-new-pos-description"
                value={newPoint.description}
                onChange={(event) => setNewPoint((current) => ({ ...current, description: event.target.value }))}
                placeholder="Mostrador, caja principal..."
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox
                checked={newPoint.isEnabled}
                onCheckedChange={(checked) => setNewPoint((current) => ({ ...current, isEnabled: checked === true }))}
              />
              Activo
            </label>
            <Button type="button" onClick={createPoint} disabled={creatingPointOfSale}>
              {creatingPointOfSale ? "Creando..." : "Crear"}
            </Button>
          </div>

          {pointsOfSale.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No hay puntos de venta configurados para AFIPSDK dev.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Punto</th>
                    <th className="px-3 py-2 text-left">Ambiente</th>
                    <th className="px-3 py-2 text-left">AFIP WS</th>
                    <th className="px-3 py-2 text-left">Descripcion</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsOfSale.map((point) => {
                    const form = pointForms[point.id] ?? { description: point.description ?? "", isEnabled: point.is_enabled };
                    return (
                      <tr key={point.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-mono">{point.point_of_sale}</td>
                        <td className="px-3 py-2">dev</td>
                        <td className="px-3 py-2">wsfe</td>
                        <td className="px-3 py-2">
                          <Input
                            value={form.description}
                            onChange={(event) => setPointForms((current) => ({
                              ...current,
                              [point.id]: { ...form, description: event.target.value },
                            }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={form.isEnabled}
                              onCheckedChange={(checked) => setPointForms((current) => ({
                                ...current,
                                [point.id]: { ...form, isEnabled: checked === true },
                              }))}
                            />
                            {form.isEnabled ? "Activo" : "Inactivo"}
                          </label>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updatePoint(point)}
                            disabled={updatingPointOfSale}
                          >
                            Guardar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div> : null}
      </CardContent>
    </Card>
  );
}
