import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerFormDialog, type CustomerFormState } from "@/features/customers/components/CustomerFormDialog";
import { CustomerAccountCreditDialog, type CustomerAccountCreditFormState } from "@/features/customers/components/CustomerAccountCreditDialog";
import { CustomerAccountDialog } from "@/features/customers/components/CustomerAccountDialog";
import { CustomersDataTable } from "@/features/customers/components/CustomersDataTable";
import { useCustomerAccountData } from "@/features/customers/hooks/useCustomerAccountData";
import { useCustomersPage } from "@/features/customers/hooks/useCustomersPage";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { invalidateCustomerQueries } from "@/lib/invalidate";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";

export default function CustomersPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const {
    customerToDelete,
    customers,
    dialogOpen,
    accountCustomer,
    editing,
    form,
    isLoading,
    saveMutation,
    deleteMutation,
    search,
    setCustomerToDelete,
    setDialogOpen,
    setAccountCustomer,
    setForm,
    setSearch,
    openCreate,
    openEdit,
  } = useCustomersPage({
    companyId: currentCompany?.id,
    userId: user?.id,
    toast,
  });
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditForm, setCreditForm] = useState<CustomerAccountCreditFormState>({
    amount: "",
    business_date: new Date().toISOString().slice(0, 10),
    description: "Cobro manual de cuenta corriente",
    notes: "",
  });
  const accountData = useCustomerAccountData(currentCompany?.id, accountCustomer?.id ?? null);

  const creditMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !accountCustomer?.id) throw new Error("Falta cliente o empresa");
      const amount = Number(creditForm.amount);
      const { error } = await supabase.rpc("register_customer_account_credit_manual", {
        p_company_id: currentCompany.id,
        p_customer_id: accountCustomer.id,
        p_amount: amount,
        p_description: creditForm.description,
        p_business_date: creditForm.business_date,
        p_notes: creditForm.notes || null,
        p_metadata: {
          kind: "manual_receipt",
          source: "customer_account_dialog",
        },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCustomerQueries(qc);
      await qc.invalidateQueries({ queryKey: ["customer-account-summary"] });
      await qc.invalidateQueries({ queryKey: ["customer-account-movements"] });
      setCreditDialogOpen(false);
      setCreditForm({
        amount: "",
        business_date: new Date().toISOString().slice(0, 10),
        description: "Cobro manual de cuenta corriente",
        notes: "",
      });
      toast({ title: "Cobro registrado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al registrar cobro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
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
            onOpenAccount={(customer) => setAccountCustomer(customer)}
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
        onOpenChange={setDialogOpen}
        onFormChange={setForm}
        onSubmit={() => saveMutation.mutate()}
      />

      <CustomerAccountDialog
        open={Boolean(accountCustomer)}
        customer={accountCustomer}
        summary={accountData.summary}
        movements={accountData.movements}
        isLoading={accountData.isLoading}
        onRegisterCredit={() => setCreditDialogOpen(true)}
        onOpenChange={(open) => {
          if (!open) {
            setCreditDialogOpen(false);
            setAccountCustomer(null);
          }
        }}
      />

      <CustomerAccountCreditDialog
        open={creditDialogOpen}
        customer={accountCustomer}
        form={creditForm}
        isSaving={creditMutation.isPending}
        onOpenChange={setCreditDialogOpen}
        onFormChange={setCreditForm}
        onSubmit={() => creditMutation.mutate()}
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
    </AppLayout>
  );
}
