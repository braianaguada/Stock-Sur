import { EntityDialog } from "@/components/common/EntityDialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Customer, CustomerFiscalDiagnostics } from "@/features/customers/types";
import { canUseCustomerForInvoiceA, getCuitValidationMessage } from "@/features/customers/fiscal";

export type CustomerFormState = {
  name: string;
  cuit: string;
  email: string;
  phone: string;
  is_occasional: boolean;
  account_due_days: string;
  fiscal_tax_id: string;
  fiscal_legal_name: string;
  fiscal_tax_condition: string;
  fiscal_address: string;
  fiscal_validation_status: "PENDING" | "VALIDATED_AUTO" | "ERROR";
  fiscal_validated_at: string | null;
  fiscal_lookup_diagnostics: CustomerFiscalDiagnostics | null;
};

type CustomerFormDialogProps = {
  open: boolean;
  editingCustomer: Customer | null;
  form: CustomerFormState;
  isSaving: boolean;
  isValidatingFiscal: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: CustomerFormState) => void;
  onSubmit: () => void;
  onValidateFiscal: () => void;
};

function getEnvironmentNotice(environment: string | null | undefined) {
  if (environment === "dev") return "Consulta en ambiente dev. Los CUIT reales pueden no devolver datos completos.";
  if (environment === "prod") return "Consulta de padron en produccion. No emite comprobantes. Factura A futura sigue bloqueada.";
  return null;
}

function getFiscalDiagnosticMessage(diagnostics: CustomerFiscalDiagnostics | null) {
  if (!diagnostics) return null;
  if (diagnostics.code === "TAXPAYER_NOT_FOUND") return "El CUIT no existe en el padron consultado o el ambiente no devolvio datos completos.";
  if (diagnostics.code === "TAX_CONDITION_UNKNOWN") return diagnostics.normalizationReason || "ARCA devolvio datos, pero no impuestos suficientes para determinar IVA.";
  if (diagnostics.code === "TAXPAYER_INACTIVE") return "El CUIT no esta activo en el padron consultado.";
  if (diagnostics.code === "SERVICE_NOT_ENABLED") return "El servicio no esta habilitado para el CUIT emisor o faltan credenciales de padron.";
  if (diagnostics.code === "INVALID_TAX_ID") return diagnostics.message || "El CUIT ingresado no es valido.";
  if (diagnostics.code === "LOOKUP_ENVIRONMENT_MISMATCH") return "El ambiente de consulta no coincide con la configuracion fiscal disponible.";
  if (diagnostics.code === "AFIPSDK_ERROR") return "No se pudo consultar Afip SDK.";
  return diagnostics.message || null;
}

export function CustomerFormDialog({
  open,
  editingCustomer,
  form,
  isSaving,
  isValidatingFiscal,
  onOpenChange,
  onFormChange,
  onSubmit,
  onValidateFiscal,
}: CustomerFormDialogProps) {
  const previewProfile = editingCustomer?.fiscal_profile
    ? {
      ...editingCustomer.fiscal_profile,
      tax_id: form.fiscal_tax_id,
      legal_name: form.fiscal_legal_name,
      tax_condition: form.fiscal_tax_condition || null,
      fiscal_address: form.fiscal_address || null,
        validation_status: form.fiscal_validation_status,
        validation_source: editingCustomer.fiscal_profile.validation_source,
        tax_condition_source: editingCustomer.fiscal_profile.tax_condition_source,
        legal_name_source: editingCustomer.fiscal_profile.legal_name_source,
      }
    : form.fiscal_tax_id || form.fiscal_legal_name || form.fiscal_tax_condition
      ? {
        id: "draft",
        company_id: editingCustomer?.company_id ?? "",
        customer_id: editingCustomer?.id ?? "",
        tax_id: form.fiscal_tax_id,
        legal_name: form.fiscal_legal_name,
        tax_condition: form.fiscal_tax_condition || null,
        fiscal_address: form.fiscal_address || null,
        taxpayer_status: null,
        validation_status: form.fiscal_validation_status,
        validation_source: null,
        tax_condition_source: null,
        legal_name_source: null,
        validation_error: null,
        validation_snapshot: null,
        validated_at: null,
        created_by: null,
        updated_by: null,
        created_at: "",
        updated_at: "",
      }
      : null;
  const invoiceAReadiness = canUseCustomerForInvoiceA(
    editingCustomer ? { ...editingCustomer, is_occasional: false } : null,
    previewProfile,
  );
  const cuitMessage = form.fiscal_tax_id ? getCuitValidationMessage(form.fiscal_tax_id) : null;
  const canValidateFiscalTaxId = Boolean(form.fiscal_tax_id.trim()) && !cuitMessage;
  const detectedTaxpayerStatus = editingCustomer?.fiscal_profile?.taxpayer_status ?? "-";
  const diagnostics = form.fiscal_lookup_diagnostics;
  const environmentNotice = diagnostics?.warning ?? getEnvironmentNotice(diagnostics?.lookupEnvironment);
  const diagnosticMessage = getFiscalDiagnosticMessage(diagnostics);
  const technicalState = diagnostics
    ? [
      `taxpayerFound=${diagnostics.taxpayerFound ? "true" : "false"}`,
      `datosGenerales=${diagnostics.hasDatosGenerales ? "true" : "false"}`,
      `regimenGeneral=${diagnostics.hasRegimenGeneral ? "true" : "false"}`,
      `impuestos=${diagnostics.hasImpuestos ? "true" : "false"}`,
      `monotributo=${diagnostics.hasMonotributo ? "true" : "false"}`,
      `eligibleForInvoiceA=${diagnostics.eligibleForInvoiceA ? "true" : "false"}`,
      `code=${diagnostics.code}`,
    ].join(" | ")
    : null;
  const detectedAt = form.fiscal_validated_at
    ? new Date(form.fiscal_validated_at).toLocaleString("es-AR")
    : "-";

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingCustomer ? "Editar cliente" : "Nuevo cliente"}
      description="Administra los datos comerciales y, si corresponde, el perfil fiscal para Factura A."
      contentClassName="sm:max-w-xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-semibold">Datos comerciales</h3>
          </div>
          <div className="space-y-2">
            <Label>Nombre comercial / contacto *</Label>
            <Input
              value={form.name}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={form.phone}
                onChange={(event) => onFormChange({ ...form, phone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => onFormChange({ ...form, email: event.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Días de vencimiento de cuenta corriente</Label>
            <Input
              type="number"
              min={0}
              max={3650}
              step={1}
              value={form.account_due_days}
              onChange={(event) => onFormChange({ ...form, account_due_days: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Se aplica a los nuevos vencimientos del estado de cuenta de este cliente.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Cliente ocasional no aplica: los clientes creados aqui son registrados.</p>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Datos fiscales para Factura A futura</h3>
              <p className="text-xs text-muted-foreground">Fuente: Constancia de inscripcion ARCA. No emite comprobantes.</p>
            </div>
            <Badge variant={invoiceAReadiness.allowed ? "default" : "secondary"}>
              {invoiceAReadiness.allowed ? "Listo para Factura A" : "No listo para Factura A"}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>CUIT fiscal para Factura A</Label>
            <Input
              value={form.fiscal_tax_id}
              onChange={(event) => onFormChange({
                ...form,
                fiscal_tax_id: event.target.value,
                fiscal_validation_status: "PENDING",
                fiscal_validated_at: null,
                fiscal_lookup_diagnostics: null,
              })}
              placeholder="20-40937847-2"
            />
            {!form.fiscal_tax_id ? (
              <p className="text-xs text-muted-foreground">Ingresa un CUIT y validalo para completar los datos fiscales.</p>
            ) : null}
            {cuitMessage ? <p className="text-xs text-destructive">{cuitMessage}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Razon social detectada</Label>
              <Input value={form.fiscal_legal_name} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Condicion IVA detectada</Label>
              <Input value={form.fiscal_tax_condition} readOnly />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Domicilio fiscal detectado</Label>
            <Input value={form.fiscal_address} readOnly />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Estado CUIT / estado clave</Label>
              <Input value={diagnostics?.taxpayerStatus ?? detectedTaxpayerStatus} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Fecha de validacion</Label>
              <Input value={detectedAt} readOnly />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Estado: {form.fiscal_validation_status}</span>
            <span>Fuente: {diagnostics ? `${diagnostics.wsid}/${diagnostics.method}` : "Constancia de inscripcion ARCA"}</span>
          </div>

          {diagnostics ? (
            <div className="space-y-2 rounded-md border border-dashed p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Ambiente de consulta: {diagnostics.lookupEnvironment}</Badge>
                <Badge variant="outline">Emision fiscal: {diagnostics.billingEnvironment}</Badge>
                <Badge variant="outline">Condicion: {diagnostics.taxCondition || "UNKNOWN"}</Badge>
                <Badge variant="outline">CUIT emisor: {diagnostics.issuerTaxIdMasked}</Badge>
              </div>
              {environmentNotice ? <p className="text-muted-foreground">{environmentNotice}</p> : null}
              <p className="text-muted-foreground">Factura A futura. No emite comprobantes desde esta validacion.</p>
              {diagnosticMessage ? (
                <p className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{diagnosticMessage}</span>
                </p>
              ) : null}
              {technicalState ? <p className="break-words text-muted-foreground">Estado tecnico QA: {technicalState}</p> : null}
              {diagnostics.availableTaxDescriptions.length > 0 ? (
                <p className="break-words text-muted-foreground">
                  Impuestos detectados: {diagnostics.availableTaxDescriptions.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {!invoiceAReadiness.allowed && invoiceAReadiness.reasons.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {invoiceAReadiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onValidateFiscal}
              disabled={!editingCustomer || isValidatingFiscal || !canValidateFiscalTaxId}
            >
              {isValidatingFiscal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isValidatingFiscal ? "Validando..." : "Validar CUIT automaticamente"}
            </Button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
