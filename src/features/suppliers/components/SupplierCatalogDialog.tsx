import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function SupplierCatalogDialog(props: {
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
  orderTotal: number;
  onOrderQuantityChange: (lineId: string, value: string) => void;
  onRemoveOrderItem: (lineId: string) => void;
  onCopyOrderMessage: () => void;
  onOpenWhatsApp: () => void;
}) {
  const {
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
    orderTotal,
    onOrderQuantityChange,
    onRemoveOrderItem,
    onCopyOrderMessage,
    onOpenWhatsApp,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] w-[96vw] max-w-[1400px] overflow-hidden p-0">
        <Tabs
          value={catalogUiTab}
          onValueChange={(value) => onCatalogUiTabChange(value as "carga" | "historial" | "catalogo")}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="sticky top-0 z-20 border-b bg-background p-4">
            <DialogHeader>
              <DialogTitle>Catálogos del proveedor: {selectedSupplier?.name}</DialogTitle>
            </DialogHeader>
            <TabsList className="mt-3 grid w-full grid-cols-3">
              <TabsTrigger value="carga">Subir archivo</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
              <TabsTrigger value="catalogo">Buscar catálogo</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="carga" className="mt-0 min-h-0 flex-1 overflow-auto p-4">
            <Card className="mx-auto w-full max-w-3xl">
              <CardHeader>
                <CardTitle className="text-base">Subir archivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={documentTitle} onChange={(e) => onDocumentTitleChange(e.target.value)} placeholder="Lista Febrero 2026 contado" />
                </div>
                <div className="space-y-2">
                  <Label>Agregar a listado existente (opcional)</Label>
                  <Select value={selectedCatalogId} onValueChange={onSelectedCatalogIdChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Crear nuevo listado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Crear nuevo listado</SelectItem>
                      {catalogs.map((catalog) => (
                        <SelectItem key={catalog.id} value={catalog.id}>
                          {catalog.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={documentNotes} onChange={(e) => onDocumentNotesChange(e.target.value)} placeholder="Observaciones" />
                </div>
                <div className="space-y-2">
                  <Label>Archivo</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf"
                    onChange={(e) => onSelectedFileChange(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button onClick={onUpload} disabled={isUploading || !selectedFile}>
                  {isUploading ? "Procesando..." : "Subir archivo"}
                </Button>
                {pdfProgress ? <p className="text-xs text-muted-foreground">{pdfProgress.message}</p> : null}
                {lastDiagnostics ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Filas: {lastDiagnostics.keptRows}/{lastDiagnostics.totalRows}. Descartadas por descripción vacía: {lastDiagnostics.dropped_missingDesc}, precio inválido: {lastDiagnostics.dropped_invalidPrice}, precio {"<="} 0: {lastDiagnostics.dropped_priceLE0}.
                    </p>
                    {lastDiagnostics.keptRows < 10 ? (
                      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={onOpenDropDetail}>
                        Ver detalle de filas descartadas
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial" className="mt-0 min-h-0 flex-1 overflow-auto p-4">
            <Card className="mx-auto w-full max-w-5xl">
              <CardHeader>
                <CardTitle className="text-base">Historial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isHistoryLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!isHistoryLoading && catalogs.length === 0 ? <p className="text-sm text-muted-foreground">Sin listados cargados</p> : null}
                {!isHistoryLoading
                  ? catalogs.map((catalog) => (
                      <div key={catalog.id} className="rounded border p-3">
                        <p className="font-medium">{catalog.title}</p>
                        <p className="text-xs text-muted-foreground">Creado: {formatSupplierDate(catalog.created_at)}</p>
                        <div className="mt-2 space-y-2">
                          {(versionsByCatalog[catalog.id] ?? []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin versiones</p>
                          ) : (
                            (versionsByCatalog[catalog.id] ?? []).map((version) => (
                              <button
                                type="button"
                                key={version.id}
                                onClick={() => onSelectVersion(version.id)}
                                className={`w-full rounded border p-2 text-left text-sm ${activeVersionId === version.id ? "border-primary bg-primary/5" : "border-border"}`}
                              >
                                <p className="font-medium">{version.title ?? catalog.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatSupplierDate(version.imported_at)} - {version.file_name} - {version.file_type.toUpperCase()} - {version.line_count} líneas
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalogo" className="mt-0 min-h-0 flex-1 overflow-hidden p-4">
            <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="min-h-0 flex flex-col">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-base">Buscar en catálogos</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {activeVersion
                      ? `Versión activa: ${activeVersion.title ?? catalogTitleById.get(activeVersion.catalog_id) ?? "Listado"} (${formatSupplierDate(activeVersion.imported_at)})`
                      : "Seleccioná una versión en el historial"}
                  </p>
                  <Input
                    placeholder="Buscar por descripción o código"
                    value={catalogSearch}
                    onChange={(e) => onCatalogSearchChange(e.target.value)}
                    disabled={!activeVersionId}
                  />
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  <div className="h-full min-h-0 overflow-auto rounded border">
                    <Table className="table-fixed min-w-[760px]">
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="w-[140px]">Código</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="w-[140px] text-right">Costo</TableHead>
                          <TableHead className="w-[110px]">Cantidad</TableHead>
                          <TableHead className="w-[120px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!activeVersionId ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                              Seleccioná una versión para ver líneas
                            </TableCell>
                          </TableRow>
                        ) : null}
                        {activeVersionId && isCatalogLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                              Cargando...
                            </TableCell>
                          </TableRow>
                        ) : null}
                        {activeVersionId && !isCatalogLoading && activeCatalogLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                              Sin resultados
                            </TableCell>
                          </TableRow>
                        ) : null}
                        {activeVersionId && !isCatalogLoading
                          ? activeCatalogLines.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell className="truncate font-mono text-xs" title={line.supplier_code ?? "-"}>
                                  {line.supplier_code ?? "-"}
                                </TableCell>
                                <TableCell className="truncate text-sm" title={line.raw_description}>
                                  {line.raw_description}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={lineQuantities[line.id] ?? 1}
                                    onChange={(e) => onLineQuantityChange(line.id, e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" onClick={() => onAddToOrder(line)}>Agregar</Button>
                                </TableCell>
                              </TableRow>
                            ))
                          : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-0 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">Pedido actual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 overflow-auto">
                  <div className="max-h-[42vh] space-y-2 overflow-auto">
                    {orderLines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin productos seleccionados</p>
                    ) : (
                      orderLines.map((line) => (
                        <div key={line.id} className="rounded border p-2 text-sm">
                          <p className="font-medium">{line.supplier_code ?? "S/COD"} - {line.raw_description}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={line.quantity}
                              onChange={(e) => onOrderQuantityChange(line.id, e.target.value)}
                              className="h-8"
                            />
                            <p className="text-muted-foreground">${Number(line.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                            <p className="font-medium">
                              Subtotal: ${(line.cost * line.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </p>
                            <Button variant="ghost" size="sm" onClick={() => onRemoveOrderItem(line.id)} className="ml-auto">
                              Quitar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-sm font-semibold">Total: ${orderTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>

                  {!selectedSupplier?.whatsapp ? (
                    <p className="text-sm text-amber-600">Este proveedor no tiene WhatsApp configurado.</p>
                  ) : null}

                  <div className="grid gap-2">
                    <Button variant="outline" onClick={onCopyOrderMessage}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar mensaje
                    </Button>
                    <Button onClick={onOpenWhatsApp}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Abrir WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
