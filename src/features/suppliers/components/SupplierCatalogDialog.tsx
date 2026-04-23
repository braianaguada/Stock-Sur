import { Copy, FileStack, History, Inbox, Mail, MessageCircle, Search, Upload, Wallet } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SupplierCatalogLinesTable } from "@/features/suppliers/components/SupplierCatalogLinesTable";
import { SupplierOrderTable } from "@/features/suppliers/components/SupplierOrderTable";
import type {
  CatalogLine,
  NormalizeDiagnostics,
  OrderLine,
  ParsePdfProgress,
  Supplier,
  SupplierCatalog,
  SupplierCatalogVersion,
} from "@/features/suppliers/types";
import { formatSupplierDate } from "@/features/suppliers/utils";

type SupplierCatalogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSupplier: Supplier | null;
  catalogUiTab: "carga" | "historial" | "catalogo";
  onCatalogUiTabChange: (value: "carga" | "historial" | "catalogo") => void;
  documentTitle: string;
  onDocumentTitleChange: (value: string) => void;
  documentNotes: string;
  onDocumentNotesChange: (value: string) => void;
  selectedCatalogId: string;
  onSelectedCatalogIdChange: (value: string) => void;
  selectedFile: File | null;
  onSelectedFileChange: (file: File | null) => void;
  onUpload: () => void;
  isUploading: boolean;
  pdfProgress: ParsePdfProgress | null;
  lastDiagnostics: NormalizeDiagnostics | null;
  onOpenDropDetail: () => void;
  catalogs: SupplierCatalog[];
  isHistoryLoading: boolean;
  versionsByCatalog: Record<string, SupplierCatalogVersion[]>;
  activeVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  activeVersion: SupplierCatalogVersion | null;
  catalogTitleById: Map<string, string>;
  catalogSearch: string;
  onCatalogSearchChange: (value: string) => void;
  isCatalogLoading: boolean;
  activeCatalogLines: CatalogLine[];
  lineQuantities: Record<string, number>;
  onLineQuantityChange: (lineId: string, value: string) => void;
  onAddToOrder: (line: CatalogLine) => void;
  orderLines: OrderLine[];
  orderTotalsByCurrency: Record<string, number>;
  onOrderQuantityChange: (lineId: string, value: string) => void;
  onRemoveOrderItem: (lineId: string) => void;
  onCopyOrderMessage: () => void;
  onOpenEmail: () => void;
  onOpenWhatsApp: () => void;
};

const NAV_ITEMS = [
  {
    key: "carga" as const,
    label: "Fuentes",
    helper: "Subi archivos PDF, Excel o CSV al proveedor.",
    icon: Upload,
  },
  {
    key: "historial" as const,
    label: "Versiones",
    helper: "Elegí la fuente o versión que vas a usar.",
    icon: History,
  },
  {
    key: "catalogo" as const,
    label: "Catalogo y pedido",
    helper: "Buscá productos y armá el pedido al proveedor.",
    icon: FileStack,
  },
];

export function SupplierCatalogDialog({
  open,
  onOpenChange,
  selectedSupplier,
  catalogUiTab,
  onCatalogUiTabChange,
  documentTitle,
  onDocumentTitleChange,
  documentNotes,
  onDocumentNotesChange,
  selectedCatalogId,
  onSelectedCatalogIdChange,
  selectedFile,
  onSelectedFileChange,
  onUpload,
  isUploading,
  pdfProgress,
  lastDiagnostics,
  onOpenDropDetail,
  catalogs,
  isHistoryLoading,
  versionsByCatalog,
  activeVersionId,
  onSelectVersion,
  activeVersion,
  catalogTitleById,
  catalogSearch,
  onCatalogSearchChange,
  isCatalogLoading,
  activeCatalogLines,
  lineQuantities,
  onLineQuantityChange,
  onAddToOrder,
  orderLines,
  orderTotalsByCurrency,
  onOrderQuantityChange,
  onRemoveOrderItem,
  onCopyOrderMessage,
  onOpenEmail,
  onOpenWhatsApp,
}: SupplierCatalogDialogProps) {
  const totalVersions = Object.values(versionsByCatalog).reduce((acc, versions) => acc + versions.length, 0);

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={selectedSupplier?.name ? `Proveedor: ${selectedSupplier.name}` : "Proveedor"}
      description="Workspace de carga, consolidacion y pedido."
      contentClassName="h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[1500px] overflow-hidden p-0"
    >
      <div className="grid h-full min-h-0 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="border-r bg-muted/30">
          <div className="flex h-full min-h-0 flex-col gap-4 p-4">
            <Card className="border-none bg-background shadow-sm">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selectedSupplier?.name ?? "Proveedor"}</CardTitle>
                    <CardDescription>Gestiona fuentes, catalogo consolidado y pedido.</CardDescription>
                  </div>
                  <Badge variant="secondary">Compras</Badge>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">WhatsApp:</span>{" "}
                    {selectedSupplier?.whatsapp ?? "No configurado"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Email:</span>{" "}
                    {selectedSupplier?.email ?? "No configurado"}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = catalogUiTab === item.key;
                return (
                  <Button
                    key={item.key}
                    type="button"
                    onClick={() => onCatalogUiTabChange(item.key)}
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "h-auto w-full justify-start rounded-xl border p-3 text-left",
                      active
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-background",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("rounded-lg border p-2", active ? "border-primary/30 bg-primary/10" : "bg-muted")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>

            <Card className="border-none bg-background shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Inbox className="h-4 w-4" />
                    Fuentes cargadas
                  </div>
                  <span className="font-semibold">{catalogs.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <History className="h-4 w-4" />
                    Versiones
                  </div>
                  <span className="font-semibold">{totalVersions}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    En pedido
                  </div>
                  <span className="font-semibold">{orderLines.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden bg-background">
          {catalogUiTab === "carga" ? (
            <div className="grid h-full min-h-0 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="min-h-0">
                <CardHeader>
                  <CardTitle className="text-base">Nueva fuente del proveedor</CardTitle>
                  <CardDescription>
                    Subi una lista en PDF, Excel o CSV. El sistema usa parser nativo e IA cuando el archivo lo necesita.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Titulo interno</Label>
                      <Input
                        value={documentTitle}
                        onChange={(event) => onDocumentTitleChange(event.target.value)}
                        placeholder="Lista Febrero 2026 contado"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Agregar a fuente existente</Label>
                      <Select value={selectedCatalogId} onValueChange={onSelectedCatalogIdChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Crear nueva fuente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Crear nueva fuente</SelectItem>
                          {catalogs.map((catalog) => (
                            <SelectItem key={catalog.id} value={catalog.id}>
                              {catalog.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Input
                      value={documentNotes}
                      onChange={(event) => onDocumentNotesChange(event.target.value)}
                      placeholder="Ej: contado, lista oficial, promo, actualizado por proveedor"
                    />
                  </div>

                  <Card className="border-dashed border-border/60 bg-muted/20 shadow-none">
                    <CardContent className="space-y-3 p-5">
                    <div className="space-y-3">
                      <div>
                        <div className="font-medium">Archivo a procesar</div>
                        <div className="text-sm text-muted-foreground">
                          Se soportan `.xlsx`, `.xls`, `.csv`, `.txt`, `.tsv` y `.pdf`.
                        </div>
                      </div>
                      <Input
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf"
                        onChange={(event) => onSelectedFileChange(event.target.files?.[0] ?? null)}
                      />
                      {selectedFile ? (
                        <div className="rounded-lg border bg-background p-3 text-sm">
                          <div className="font-medium">{selectedFile.name}</div>
                          <div className="text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      ) : null}
                    </div>
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={onUpload} disabled={isUploading || !selectedFile}>
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploading ? "Procesando fuente..." : "Procesar listado"}
                    </Button>
                    {pdfProgress ? (
                      <Badge variant="secondary" className="px-3 py-1 text-xs">
                        {pdfProgress.message}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Control de calidad</CardTitle>
                  <CardDescription>Senales utiles despues del parseo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <Card className="border-border/60">
                    <CardContent className="p-3">
                    <div className="font-medium">Estrategia</div>
                    <div className="mt-1 text-muted-foreground">
                      Excel/CSV va por parser logico. PDF pasa por parser estructural y, si hace falta, por motores externos como Mistral OCR o Gemini antes de la revision final.
                    </div>
                    </CardContent>
                  </Card>
                  {lastDiagnostics ? (
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                      <div className="font-medium">Ultima importacion tabular</div>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <div>Filas validas: {lastDiagnostics.keptRows} / {lastDiagnostics.totalRows}</div>
                        <div>Sin descripcion: {lastDiagnostics.dropped_missingDesc}</div>
                        <div>Precio invalido: {lastDiagnostics.dropped_invalidPrice}</div>
                        <div>Precio menor o igual a 0: {lastDiagnostics.dropped_priceLE0}</div>
                      </div>
                      {lastDiagnostics.keptRows < 10 ? (
                        <Button type="button" variant="link" className="mt-2 h-auto p-0 text-xs" onClick={onOpenDropDetail}>
                          Ver detalle de filas descartadas
                        </Button>
                      ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-border/60">
                      <CardContent className="p-3 text-muted-foreground">
                      Todavia no hay diagnostico de importacion en esta sesion.
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {catalogUiTab === "historial" ? (
            <div className="h-full overflow-auto p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fuentes y versiones</CardTitle>
                  <CardDescription>
                    Cada listado puede tener varias versiones o archivos asociados. Elegi la version activa para trabajar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isHistoryLoading ? <p className="text-sm text-muted-foreground">Cargando historial...</p> : null}
                  {!isHistoryLoading && catalogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Este proveedor todavia no tiene fuentes cargadas.</p>
                  ) : null}
                  {!isHistoryLoading
                    ? catalogs.map((catalog) => (
                        <div key={catalog.id} className="rounded-2xl border bg-muted/10 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{catalog.title}</div>
                              <div className="text-xs text-muted-foreground">
                                Creado {formatSupplierDate(catalog.created_at)}
                              </div>
                            </div>
                            <Badge variant="outline">{(versionsByCatalog[catalog.id] ?? []).length} versiones</Badge>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {(versionsByCatalog[catalog.id] ?? []).length === 0 ? (
                              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                Esta fuente todavia no tiene versiones visibles.
                              </div>
                            ) : (
                              (versionsByCatalog[catalog.id] ?? []).map((version) => (
                                <Button
                                  type="button"
                                  key={version.id}
                                  onClick={() => onSelectVersion(version.id)}
                                  className={cn(
                                    "h-auto w-full rounded-xl border p-4 text-left transition-colors justify-start",
                                    activeVersionId === version.id
                                      ? "border-primary bg-primary/6"
                                      : "border-border bg-background hover:border-primary/40",
                                  )}
                                  variant={activeVersionId === version.id ? "secondary" : "ghost"}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-medium">
                                        {version.title ?? catalog.title}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {formatSupplierDate(version.imported_at)}
                                      </div>
                                    </div>
                                    {activeVersionId === version.id ? <Badge>Activa</Badge> : null}
                                  </div>
                                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                                    <div>Archivo: {version.file_name}</div>
                                    <div>Tipo: {version.file_type.toUpperCase()}</div>
                                    <div>Items importados: {version.line_count}</div>
                                  </div>
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    : null}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {catalogUiTab === "catalogo" ? (
            <div className="grid h-full min-h-0 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="min-h-0 flex flex-col">
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Catalogo consolidado</CardTitle>
                      <CardDescription>
                        {activeVersion
                          ? `Version activa: ${activeVersion.title ?? catalogTitleById.get(activeVersion.catalog_id) ?? "Listado"}`
                          : "Selecciona una version desde la seccion Versiones."}
                      </CardDescription>
                    </div>
                    {activeVersion ? (
                      <Badge variant="secondary">{formatSupplierDate(activeVersion.imported_at)}</Badge>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por descripcion o codigo"
                      value={catalogSearch}
                      onChange={(event) => onCatalogSearchChange(event.target.value)}
                      disabled={!activeVersionId}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1">
                  <div className="h-full min-h-0 overflow-auto rounded-xl border">
                    <SupplierCatalogLinesTable
                      lines={activeCatalogLines}
                      activeVersionId={activeVersionId}
                      isLoading={isCatalogLoading}
                      quantities={lineQuantities}
                      onQuantityChange={onLineQuantityChange}
                      onAdd={onAddToOrder}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-0 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">Pedido al proveedor</CardTitle>
                  <CardDescription>Selecciona productos, cantidades y genera el mensaje.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
                  <Card className="min-h-[240px] overflow-hidden border-border/60 bg-background shadow-sm">
                    <CardContent className="p-0">
                    <SupplierOrderTable
                      rows={orderLines}
                      onQuantityChange={onOrderQuantityChange}
                      onRemove={onRemoveOrderItem}
                    />
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-muted/20 shadow-sm">
                    <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total estimado</div>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(orderTotalsByCurrency).length > 0 ? (
                        Object.entries(orderTotalsByCurrency)
                          .sort(([left], [right]) => left.localeCompare(right))
                          .map(([currency, total]) => (
                            <div key={currency} className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-muted-foreground">{currency}</span>
                              <span className="text-lg font-semibold">
                                {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))
                      ) : (
                        <div className="text-lg font-semibold">0.00</div>
                      )}
                    </div>
                    </CardContent>
                  </Card>

                  {!selectedSupplier?.whatsapp || !selectedSupplier?.email ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                      {!selectedSupplier?.whatsapp && !selectedSupplier?.email
                        ? "Este proveedor no tiene WhatsApp ni email configurados. Puedes copiar el mensaje, pero no abrir envio directo."
                        : !selectedSupplier?.whatsapp
                          ? "Este proveedor no tiene WhatsApp configurado. Puedes copiar el mensaje o usar email."
                          : "Este proveedor no tiene email configurado. Puedes copiar el mensaje o usar WhatsApp."}
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    <Button variant="outline" onClick={onCopyOrderMessage}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar mensaje
                    </Button>
                    <Button variant="outline" onClick={onOpenEmail}>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar por email
                    </Button>
                    <Button onClick={onOpenWhatsApp}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Enviar por WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </div>
    </EntityDialog>
  );
}
