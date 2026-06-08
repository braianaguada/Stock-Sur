import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerAccountDialog } from "@/features/customers/components/CustomerAccountDialog";
import { CustomerFormDialog } from "@/features/customers/components/CustomerFormDialog";
import { CustomersDataTable } from "@/features/customers/components/CustomersDataTable";
import type { Customer } from "@/features/customers/types";
import { useCustomersPage } from "@/features/customers/hooks/useCustomersPage";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";

export default function CustomersPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const [accountCustomer, setAccountCustomer] = useState<Customer | null>(null);
  const {
    customerToDelete,
    customers,
    dialogOpen,
    editing,
    form,
    isLoading,
    saveMutation,
    validateFiscalMutation,
    deleteMutation,
    search,
    setCustomerToDelete,
    setDialogOpen,
    setForm,
    setSearch,
    openCreate,
    openEdit,
  } = useCustomersPage({
    companyId: currentCompany?.id,
    userId: user?.id,
    toast,
  });

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <div className="surface-card-muted max-w-2xl px-5 py-4 text-sm text-foreground">
            Selecciona una empresa para gestionar sus clientes.
          </div>
        ) : null}

        <PageHeader
          eyebrow="Base comercial"
          title="Clientes"
          description="Gestion de clientes con una lectura mas limpia para escritorio."
          actions={(
            <Button onClick={openCreate} disabled={!currentCompany}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
            </Button>
          )}
        />

        <FilterBar>
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, CUIT, email o telefono..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </FilterBar>

        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Cliente ocasional / Consumidor Final</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Sistema</Badge>
                <Badge variant="secondary">No editable</Badge>
                <Badge variant="outline">Operaciones sin cliente registrado</Badge>
                <Badge variant="outline">customer_id = null</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">No aplica Factura A ni cuenta corriente.</p>
            </div>
            <Button type="button" variant="outline" asChild>
              <Link to="/customers/occasional">Ver seguimiento</Link>
            </Button>
          </div>
        </div>

        <DataCard>
          <CustomersDataTable
            customers={customers}
            isLoading={isLoading}
            onViewAccount={setAccountCustomer}
            onEdit={openEdit}
            onDelete={setCustomerToDelete}
          />
        </DataCard>
      </div>

      <CustomerFormDialog
        open={dialogOpen}
        editingCustomer={editing}
        form={form}
        isSaving={saveMutation.isPending}
        isValidatingFiscal={validateFiscalMutation.isPending}
        onOpenChange={setDialogOpen}
        onFormChange={setForm}
        onSubmit={() => saveMutation.mutate()}
        onValidateFiscal={() => validateFiscalMutation.mutate()}
      />

      <ConfirmDeleteDialog
        open={!!customerToDelete}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
        title="Eliminar cliente"
        description={customerToDelete ? `Esta accion eliminara a "${customerToDelete.name}" de forma permanente.` : ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!customerToDelete) return;
          deleteMutation.mutate(customerToDelete.id);
          setCustomerToDelete(null);
        }}
      />

      <CustomerAccountDialog
        open={!!accountCustomer}
        companyId={currentCompany?.id}
        customer={accountCustomer}
        onOpenChange={(open) => {
          if (!open) setAccountCustomer(null);
        }}
        onToast={toast}
      />
    </AppLayout>
  );
}
