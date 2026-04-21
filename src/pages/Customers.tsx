import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerFormDialog, type CustomerFormState } from "@/features/customers/components/CustomerFormDialog";
import { CustomerAccountDialog } from "@/features/customers/components/CustomerAccountDialog";
import { CustomersDataTable } from "@/features/customers/components/CustomersDataTable";
import { useCustomerAccountData } from "@/features/customers/hooks/useCustomerAccountData";
import { useCustomersPage } from "@/features/customers/hooks/useCustomersPage";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";

export default function CustomersPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const {
    customerToDelete,
    customers,
    dialogOpen,
    editing,
    form,
    isLoading,
    saveMutation,
    deleteMutation,
    search,
    setCustomerToDelete,
    setDialogOpen,
    setForm,
    setSearch,
    openCreate,
    openEdit,
    accountCustomer,
    setAccountCustomer,
  } = useCustomersPage({
    companyId: currentCompany?.id,
    userId: user?.id,
    toast,
  });
  const accountData = useCustomerAccountData(currentCompany?.id ?? null, accountCustomer?.id ?? null);

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
          description="Gestion de clientes con una lectura mas limpia para escritorio, manteniendo intactas altas, edicion y borrado."
          actions={(
            <Button onClick={openCreate} disabled={!currentCompany}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
            </Button>
          )}
        />

        <FilterBar>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o CUIT..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </FilterBar>

        <DataCard>
          <CustomersDataTable
            customers={customers}
            isLoading={isLoading}
            onEdit={openEdit}
            onOpenAccount={setAccountCustomer}
            onDelete={setCustomerToDelete}
          />
        </DataCard>
      </div>

      <CustomerFormDialog
        open={dialogOpen}
        editingCustomer={editing}
        form={form}
        isSaving={saveMutation.isPending}
        onOpenChange={setDialogOpen}
        onFormChange={setForm}
        onSubmit={() => saveMutation.mutate()}
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
        open={Boolean(accountCustomer)}
        customer={accountCustomer}
        summary={accountData.summary}
        movements={accountData.movements}
        isLoading={accountData.isLoading}
        onOpenChange={(open) => {
          if (!open) setAccountCustomer(null);
        }}
      />
    </AppLayout>
  );
}
