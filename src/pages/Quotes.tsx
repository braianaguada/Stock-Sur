import { Suspense, lazy } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { QuotesTable } from "@/features/quotes/components/QuotesTable";
import { useQuotesFlow } from "@/features/quotes/hooks/useQuotesFlow";

const QuoteDetailDialog = lazy(() => import("@/features/quotes/components/QuoteDetailDialog").then((module) => ({ default: module.QuoteDetailDialog })));
const QuoteEditorDialog = lazy(() => import("@/features/quotes/components/QuoteEditorDialog").then((module) => ({ default: module.QuoteEditorDialog })));

function QuotesDialogLoader() {
  return <div className="py-8 text-center text-sm text-muted-foreground">Cargando presupuesto...</div>;
}

export default function QuotesPage() {
  const { settings } = useCompanyBrand();
  const { toast } = useToast();
  const { user, currentCompany } = useAuth();
  const {
    addLine,
    currentCompanyId,
    customers,
    deleteMutation,
    detailDialogOpen,
    dialogOpen,
    exportPDF,
    form,
    isLoading,
    lines,
    openCreate,
    quoteLines,
    quoteToDelete,
    quotes,
    removeLine,
    saveMutation,
    search,
    selectedQuoteId,
    setDetailDialogOpen,
    setDialogOpen,
    setForm,
    setQuoteToDelete,
    setSearch,
    setSelectedQuoteId,
    updateLine,
  } = useQuotesFlow({
    appName: settings.app_name,
    currentCompanyId: currentCompany?.id ?? null,
    userId: user?.id ?? null,
    toast,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
            <p className="text-muted-foreground">Crear y exportar presupuestos</p>
          </div>
          <Button onClick={openCreate} disabled={!currentCompanyId}><Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto</Button>
        </div>

        {!currentCompanyId ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            Selecciona una empresa activa para ver y crear presupuestos.
          </div>
        ) : null}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o numero..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!currentCompanyId}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <QuotesTable
            quotes={quotes}
            isLoading={isLoading}
            onView={(quote) => {
              setSelectedQuoteId(quote.id);
              setDetailDialogOpen(true);
            }}
            onExport={exportPDF}
            onDelete={setQuoteToDelete}
          />
        </div>
      </div>

      {dialogOpen ? (
        <Suspense fallback={<QuotesDialogLoader />}>
          <QuoteEditorDialog
            open={dialogOpen}
            customers={customers}
            form={form}
            lines={lines}
            isSaving={saveMutation.isPending}
            onOpenChange={setDialogOpen}
            onFormChange={setForm}
            onAddLine={addLine}
            onLineChange={updateLine}
            onRemoveLine={removeLine}
            onSubmit={() => saveMutation.mutate()}
          />
        </Suspense>
      ) : null}

      <ConfirmDeleteDialog
        open={!!quoteToDelete}
        onOpenChange={(open) => {
          if (!open) setQuoteToDelete(null);
        }}
        title="Eliminar presupuesto"
        description={quoteToDelete ? `Esta accion eliminara el presupuesto #${quoteToDelete.quote_number} de forma permanente.` : ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!quoteToDelete) return;
          deleteMutation.mutate(quoteToDelete.id);
          setQuoteToDelete(null);
        }}
      />

      {detailDialogOpen ? (
        <Suspense fallback={<QuotesDialogLoader />}>
          <QuoteDetailDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen} lines={quoteLines} />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}
