import { EntityDialog } from "@/components/common/EntityDialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Customer } from "@/features/customers/types";
import { canUseCustomerForInvoiceA, getCuitValidationMessage } from "@/features/customers/fiscal";

export type CustomerFormState = {
  name: string;
  cuit: string;
  email: string;
  phone: string;
  is_occasional: boolean;
  fiscal_tax_id: string;
  fiscal_legal_name: string;
  fiscal_tax_condition: string;
  fiscal_address: string;
  fiscal_validation_status: "PENDING" | "VALIDATED" | "ERROR" | "MANUAL_REVIEW";
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
        validation_status: form.fiscal_validation_status,
        validation_source: null,
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
    editingCustomer ? { ...editingCustomer, is_occasional: form.is_occasional } : null,
    previewProfile,
  );
  const cuitMessage = form.fiscal_tax_id ? getCuitValidationMessage(form.fiscal_tax_id) : null;

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingCustomer ? "Editar cliente" : "Nuevo cliente"}
      description="Administra los datos comerciales y el perfil fiscal del cliente."
      contentClassName="sm:max-w-xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>CUIT</Label>
            <Input
              value={form.cuit}
              onChange={(event) => onFormChange({ ...form, cuit: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefono</Label>
            <Input
              value={form.phone}
              onChange={(event) => onFormChange({ ...form, phone: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => onFormChange({ ...form, email: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_occasional}
            onChange={(event) => onFormChange({ ...form, is_occasional: event.target.checked })}
            className="rounded"
          />
          Cliente ocasional
        </label>
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Datos fiscales</h3>
              <p className="text-xs text-muted-foreground">Preparacion para Factura A futura. No emite comprobantes.</p>
            </div>
            <Badge variant={invoiceAReadiness.allowed ? "default" : "secondary"}>
              {invoiceAReadiness.allowed ? "Listo para Factura A" : "No listo para Factura A"}
            </Badge>
          </div>

          {form.is_occasional ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Cliente ocasional no es valido para Factura A.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>CUIT fiscal</Label>
              <Input
                value={form.fiscal_tax_id}
                onChange={(event) => onFormChange({ ...form, fiscal_tax_id: event.target.value, fiscal_validation_status: "PENDING" })}
                placeholder="20-40937847-2"
              />
              {cuitMessage ? <p className="text-xs text-destructive">{cuitMessage}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Condicion IVA</Label>
              <Input
                value={form.fiscal_tax_condition}
                onChange={(event) => onFormChange({ ...form, fiscal_tax_condition: event.target.value, fiscal_validation_status: "MANUAL_REVIEW" })}
                placeholder="Responsable Inscripto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Razon social / nombre fiscal</Label>
            <Input
              value={form.fiscal_legal_name}
              onChange={(event) => onFormChange({ ...form, fiscal_legal_name: event.target.value, fiscal_validation_status: "MANUAL_REVIEW" })}
            />
          </div>

          <div className="space-y-2">
            <Label>Domicilio fiscal</Label>
            <Input
              value={form.fiscal_address}
              onChange={(event) => onFormChange({ ...form, fiscal_address: event.target.value, fiscal_validation_status: "MANUAL_REVIEW" })}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Estado: {form.fiscal_validation_status}</span>
            <span>Validado: {editingCustomer?.fiscal_profile?.validated_at ? new Date(editingCustomer.fiscal_profile.validated_at).toLocaleString("es-AR") : "-"}</span>
          </div>

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
              disabled={!editingCustomer || isValidatingFiscal || form.is_occasional}
            >
              {isValidatingFiscal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isValidatingFiscal ? "Validando..." : "Validar CUIT"}
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
