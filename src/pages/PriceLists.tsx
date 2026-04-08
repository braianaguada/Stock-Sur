import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, RefreshCcw, Search } from "lucide-react";
import { BasePricesTable } from "@/features/price-lists/components/BasePricesTable";
import { PriceListCreateDialog } from "@/features/price-lists/components/PriceListCreateDialog";
import { PriceListDetailDialog } from "@/features/price-lists/components/PriceListDetailDialog";
import { DEFAULT_PRICE_LIST_FORM, PRICE_LIST_STATUS_LABEL } from "@/features/price-lists/constants";
import type { PriceListFormState } from "@/features/price-lists/types";
import { usePriceListsData } from "@/features/price-lists/use-price-lists-data";
import { formatDateTime, parseNonNegative } from "@/features/price-lists/utils";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";

const pricingChipClass = {
  flete: "border-blue-200/80 bg-blue-50/90 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200",
  margen: "border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  iva: "border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
} as const;

export default function PriceListsPage() {
  const { currentCompany } = useAuth();

  const [moduleTab, setModuleTab] = useState("base");
  const [baseSearch, setBaseSearch] = useState("");
  const [basePage, setBasePage] = useState(1);
  const [listSearch, setListSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("products");
  const [createForm, setCreateForm] = useState<PriceListFormState>(DEFAULT_PRICE_LIST_FORM);
  const [configDraft, setConfigDraft] = useState<PriceListFormState | null>(null);
  const [baseCostDrafts, setBaseCostDrafts] = useState<Record<string, string>>({});

  const {
    baseRows,
    pagedBaseRows,
    priceLists,
    profileNameByUserId,
    selectedList,
    selectedListHistory,
    pagedSelectedListProducts,
    updateBaseCostMutation,
    createListMutation,
    updateListConfigMutation,
    recalculateMutation,
    deleteListMutation,
    basePagination,
    detailPagination,
  } = usePriceListsData({
    basePage,
    baseSearch,
    detailPage,
    detailSearch,
    listSearch,
    selectedListId,
  });

  useEffect(() => {
    setBaseCostDrafts(
      Object.fromEntries(baseRows.map((row) => [row.item_id, String(row.base_cost ?? 0)])),
    );
  }, [baseRows]);

  useEffect(() => {
    if (!selectedList) {
      setConfigDraft(null);
      return;
    }

    setConfigDraft({
      name: selectedList.name,
      description: selectedList.description ?? "",
      flete_pct: String(selectedList.flete_pct ?? 0),
      utilidad_pct: String(selectedList.utilidad_pct ?? 0),
      impuesto_pct: String(selectedList.impuesto_pct ?? 0),
    });
  }, [selectedList]);

  const openListDetail = (priceListId: string) => {
    setSelectedListId(priceListId);
    setDetailSearch("");
    setDetailPage(1);
    setDetailTab("products");
    setDetailDialogOpen(true);
  };

  const renderUserName = (userId: string | null) => {
    if (!userId) return "-";
    return profileNameByUserId.get(userId) ?? userId.slice(0, 8);
  };

  const renderPricingSummary = (values: {
    flete_pct: number | null;
    utilidad_pct: number | null;
    impuesto_pct: number | null;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" className={`px-2.5 py-0.5 text-[10px] ${pricingChipClass.flete}`}>
        Flete {values.flete_pct ?? 0}%
      </Badge>
      <Badge variant="outline" className={`px-2.5 py-0.5 text-[10px] ${pricingChipClass.margen}`}>
        Margen {values.utilidad_pct ?? 0}%
      </Badge>
      <Badge variant="outline" className={`px-2.5 py-0.5 text-[10px] ${pricingChipClass.iva}`}>
        IVA {values.impuesto_pct ?? 0}%
      </Badge>
    </div>
  );

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para gestionar precios base y listas." />
        ) : null}

        <PageHeader
          eyebrow="Pricing operativo"
          title="Precios"
          subtitle="Gestiona costos base y listas de precios derivadas con una lectura mas clara, manteniendo intactos calculos, recalculos e historial."
          tabs={[
            { label: "Precios base", value: "base" },
            { label: "Listas", value: "lists" },
          ]}
          activeTab={moduleTab}
          onTabChange={setModuleTab}
          actions={moduleTab === "lists" ? (
            <Button onClick={() => { setCreateForm(DEFAULT_PRICE_LIST_FORM); setCreateDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nueva lista
            </Button>
          ) : undefined}
        />

        <Tabs value={moduleTab} onValueChange={setModuleTab}>
          <TabsContent value="base" className="space-y-5 pt-1">
            <FilterBar>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU, nombre, marca, modelo o categoria..."
                  className="pl-9"
                  value={baseSearch}
                  onChange={(event) => {
                    setBaseSearch(event.target.value);
                    setBasePage(1);
                  }}
                />
              </div>
            </FilterBar>
            <DataCard>
              <BasePricesTable
                rows={pagedBaseRows}
                baseCostDrafts={baseCostDrafts}
                isSaving={updateBaseCostMutation.isPending}
                pageSize={10}
                renderUserName={renderUserName}
                onDraftChange={setBaseCostDrafts}
                onSaveDraftValue={(itemId, draftValue) =>
                  updateBaseCostMutation.mutate({ itemId, baseCost: parseNonNegative(draftValue, 0) })}
              />
            </DataCard>
            <DataTablePagination
              page={basePagination.page}
              totalPages={basePagination.totalPages}
              totalItems={basePagination.totalItems}
              rangeStart={basePagination.totalItems === 0 ? 0 : (basePagination.page - 1) * 10 + 1}
              rangeEnd={Math.min(basePagination.page * 10, basePagination.totalItems)}
              onPageChange={setBasePage}
              itemLabel="productos"
            />
          </TabsContent>

          <TabsContent value="lists" className="space-y-5 pt-1">
            <FilterBar>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar lista..."
                  className="pl-9"
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                />
              </div>
            </FilterBar>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {priceLists.length === 0 ? (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No hay listas de precios creadas.
                  </CardContent>
                </Card>
              ) : priceLists.map((priceList) => (
                <Card key={priceList.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{priceList.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{priceList.description || "Sin descripcion"}</p>
                      </div>
                      <Badge variant={priceList.status === "UPDATED" ? "default" : "secondary"}>
                        {PRICE_LIST_STATUS_LABEL[priceList.status]}
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/45 p-3">
                      {renderPricingSummary(priceList)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Productos</span>
                      <span className="text-right">{priceList.total_items_count}</span>
                      <span>Pendientes</span>
                      <span className="text-right">{priceList.pending_items_count}</span>
                      <span>Ult. recalculo</span>
                      <span className="text-right">{formatDateTime(priceList.last_recalculated_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => openListDetail(priceList.id)}>Ver lista</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedListId(priceList.id);
                          recalculateMutation.mutate(priceList.id);
                        }}
                        disabled={recalculateMutation.isPending}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" /> Recalcular
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PriceListCreateDialog
        open={createDialogOpen}
        form={createForm}
        isSaving={createListMutation.isPending}
        onOpenChange={setCreateDialogOpen}
        onFormChange={setCreateForm}
        onSubmit={() => createListMutation.mutate(createForm, {
          onSuccess: () => {
            setCreateDialogOpen(false);
            setCreateForm(DEFAULT_PRICE_LIST_FORM);
          },
        })}
      />

      <PriceListDetailDialog
        open={detailDialogOpen}
        selectedList={selectedList}
        selectedListHistory={selectedListHistory}
        pagedProducts={pagedSelectedListProducts}
        detailSearch={detailSearch}
        detailTab={detailTab}
        detailPage={detailPagination.page}
        detailTotalItems={detailPagination.totalItems}
        detailTotalPages={detailPagination.totalPages}
        configDraft={configDraft}
        isRecalculating={recalculateMutation.isPending}
        isSavingConfig={updateListConfigMutation.isPending}
        isDeleting={deleteListMutation.isPending}
        renderUserName={renderUserName}
        renderPricingSummary={renderPricingSummary}
        onOpenChange={setDetailDialogOpen}
        onDetailTabChange={setDetailTab}
        onDetailSearchChange={(value) => {
          setDetailSearch(value);
          setDetailPage(1);
        }}
        onDetailPageChange={setDetailPage}
        onConfigDraftChange={setConfigDraft}
        onSaveConfig={() => {
          if (!selectedListId || !configDraft) return;
          updateListConfigMutation.mutate({ form: configDraft, priceListId: selectedListId });
        }}
        onRecalculate={() => {
          if (!selectedListId) return;
          recalculateMutation.mutate(selectedListId);
        }}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar lista de precios"
        description={
          selectedList
            ? `Se eliminara la lista "${selectedList.name}". Si ya fue usada en documentos, el sistema no permitira borrarla.`
            : "Se eliminara la lista seleccionada."
        }
        confirmLabel="Eliminar lista"
        isPending={deleteListMutation.isPending}
        onConfirm={() => {
          if (!selectedListId) return;
          deleteListMutation.mutate(selectedListId, {
            onSuccess: () => {
              setDeleteDialogOpen(false);
              setDetailDialogOpen(false);
              setSelectedListId(null);
            },
          });
        }}
      />
    </AppLayout>
  );
}
