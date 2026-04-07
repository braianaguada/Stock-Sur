import { useState } from "react";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";
import { PendingAliasDialog } from "@/features/pending/components/PendingAliasDialog";
import { PendingAssignDialog } from "@/features/pending/components/PendingAssignDialog";
import { PendingLinesTable } from "@/features/pending/components/PendingLinesTable";
import { usePendingMatching } from "@/features/pending/hooks/usePendingMatching";

export default function PendingPage() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const {
    aliasDialogOpen,
    aliasValue,
    assignDialogOpen,
    createItemWithAlias,
    isLoading,
    isSubmitting,
    itemSearch,
    items,
    newItemName,
    openAliasDialog,
    openAssign,
    pendingLines,
    saveAsSupplierCodeAlias,
    search,
    selectedItemId,
    selectedLine,
    setAliasDialogOpen,
    setAliasValue,
    setAssignDialogOpen,
    setItemSearch,
    setNewItemName,
    setSaveAsSupplierCodeAlias,
    setSearch,
    setSelectedItemId,
    assignWithoutAlias,
    assignWithAlias,
  } = usePendingMatching({
    companyId: currentCompany?.id,
    toast,
  });

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para revisar pendientes de catalogos y vincularlos con articulos." />
        ) : null}

        <PageHeader
          eyebrow="Matching operativo"
          title="Pendientes"
          description="Lineas de listas de precios sin asignar a un item. Se prioriza lectura, contexto y acciones mas claras sin tocar el flujo de asignacion."
        />

        <FilterBar>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar descripcion..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </FilterBar>

        <DataCard>
          <PendingLinesTable lines={pendingLines} isLoading={isLoading} onAssign={openAssign} />
        </DataCard>
      </div>

      <PendingAssignDialog
        open={assignDialogOpen}
        line={selectedLine}
        itemSearch={itemSearch}
        items={items}
        selectedItemId={selectedItemId}
        onOpenChange={setAssignDialogOpen}
        onItemSearchChange={setItemSearch}
        onSelectedItemChange={setSelectedItemId}
        onContinue={openAliasDialog}
      />

      <PendingAliasDialog
        open={aliasDialogOpen}
        line={selectedLine}
        aliasValue={aliasValue}
        newItemName={newItemName}
        saveAsSupplierCodeAlias={saveAsSupplierCodeAlias}
        isSubmitting={isSubmitting}
        onOpenChange={setAliasDialogOpen}
        onAliasChange={setAliasValue}
        onNewItemNameChange={setNewItemName}
        onSupplierCodeAliasChange={setSaveAsSupplierCodeAlias}
        onAssignWithoutAlias={assignWithoutAlias}
        onAssignWithAlias={assignWithAlias}
        onCreateItemWithAlias={createItemWithAlias}
      />
    </AppLayout>
  );
}
