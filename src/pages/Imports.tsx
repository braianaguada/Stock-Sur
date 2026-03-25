import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Check } from "lucide-react";
import { useImportsFlow } from "@/features/imports/hooks/useImportsFlow";

export default function ImportsPage() {
  const { currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
  const { toast } = useToast();
  const canCreateImports =
    companyRoleCodes.includes("admin") || companyPermissionCodes.includes("imports.create");
  const {
    goPreview,
    handleFileUpload,
    headers,
    importMutation,
    mapping,
    notes,
    previewData,
    priceLists,
    reset,
    selectedPriceListId,
    setMapping,
    setNotes,
    setSelectedPriceListId,
    setStep,
    step,
    validRows,
  } = useImportsFlow({
    currentCompanyId: currentCompany?.id ?? null,
    toast,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitás una empresa activa para importar archivos y generar nuevas versiones de listas." />
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importaciones</h1>
          <p className="text-muted-foreground">Importar listas de precios desde CSV o XLSX</p>
        </div>

        {currentCompany && !canCreateImports ? (
          <CompanyAccessNotice description="Tu usuario puede ver importaciones, pero no crear nuevas versiones. Pedile a un administrador acceso de edicion para continuar." />
        ) : null}

        {step === "upload" && canCreateImports && (
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-lg">Subir archivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Lista de precios *</Label>
                <Select value={selectedPriceListId} onValueChange={setSelectedPriceListId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lista" /></SelectTrigger>
                  <SelectContent>
                    {priceLists.map((priceList) => (
                      <SelectItem key={priceList.id} value={priceList.id}>{priceList.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej: Lista marzo 2026" />
              </div>
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-3 text-sm text-muted-foreground">Arrastra o selecciona un archivo CSV/XLSX</p>
                <Input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="mx-auto max-w-xs" />
              </div>
            </CardContent>
          </Card>
        )}

        {step === "map" && canCreateImports && (
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-lg">Mapeo de columnas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{validRows.length} filas válidas detectadas. Mapeá las columnas:</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Código proveedor (opcional)</Label>
                  <Select value={mapping.supplier_code} onValueChange={(value) => setMapping({ ...mapping, supplier_code: value })}>
                    <SelectTrigger><SelectValue placeholder="No mapear" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No mapear</SelectItem>
                      {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descripción *</Label>
                  <Select value={mapping.description} onValueChange={(value) => setMapping({ ...mapping, description: value })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Precio *</Label>
                  <Select value={mapping.price} onValueChange={(value) => setMapping({ ...mapping, price: value })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>Volver</Button>
                <Button onClick={goPreview}>Previsualizar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "preview" && canCreateImports && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Mostrando primeras {previewData.length} de {validRows.length} filas válidas</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("map")}>Volver</Button>
                <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                  {importMutation.isPending ? "Importando..." : `Confirmar importación (${validRows.length} filas)`}
                </Button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cod. Proveedor</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">{row.supplier_code || "-"}</TableCell>
                      <TableCell className="text-sm">{row.raw_description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "done" && canCreateImports && (
          <Card className="max-w-lg">
            <CardContent className="space-y-4 py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Importación completada</h2>
              <p className="text-muted-foreground">Las líneas fueron importadas. Revisá los pendientes en la sección correspondiente.</p>
              <Button onClick={reset}>Nueva importación</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
