import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Check, Upload } from "lucide-react";
import { ImportsPreviewTable } from "@/features/imports/components/ImportsPreviewTable";
import { useImportsFlow } from "@/features/imports/hooks/useImportsFlow";
import { StatusBadge } from "@/components/common/VisualSystem";
import { PageContainer, PageHeader } from "@/components/ui/page";

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
  const currentStep = ["upload", "map", "preview", "done"].indexOf(step);

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para importar archivos y generar nuevas versiones de listas." />
        ) : null}
        <PageHeader
          eyebrow="Carga masiva"
          title="Importaciones"
          description="Importar listas de precios desde CSV o XLSX con una experiencia mas clara, manteniendo el mismo flujo por pasos."
          variant="workspace"
          meta={[
            "Archivo",
            "Mapeo",
            "Validacion",
            "Resultado",
          ].map((label, index) => (
            <StatusBadge key={label} tone={index < currentStep ? "success" : index === currentStep ? "warning" : "muted"}>
              {index + 1}. {label}
            </StatusBadge>
          ))}
        />

        {currentCompany && !canCreateImports ? (
          <CompanyAccessNotice description="Tu usuario puede ver importaciones, pero no crear nuevas versiones. Pedile a un administrador acceso de edicion para continuar." />
        ) : null}

        {step === "upload" && canCreateImports ? (
          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Archivo y destino</CardTitle>
              <CardDescription>Selecciona la lista que recibira una nueva version y carga el archivo fuente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-5">
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
              </div>
              <div className="flex min-h-52 flex-col justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center sm:p-8">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-3 text-sm text-muted-foreground">Arrastra o selecciona un archivo CSV/XLSX</p>
                <Input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="mx-auto max-w-xs" />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === "map" && canCreateImports ? (
          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Mapeo de columnas</CardTitle>
              <CardDescription>{validRows.length} filas validas detectadas. Indica que columna corresponde a cada dato.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Codigo proveedor (opcional)</Label>
                  <Select value={mapping.supplier_code} onValueChange={(value) => setMapping({ ...mapping, supplier_code: value })}>
                    <SelectTrigger><SelectValue placeholder="No mapear" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No mapear</SelectItem>
                      {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descripcion *</Label>
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
            </CardContent>
            <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t bg-card/95 px-4 py-4 backdrop-blur sm:px-6">
                <Button variant="outline" onClick={() => setStep("upload")}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
                <Button onClick={goPreview}>Previsualizar</Button>
            </div>
          </Card>
        ) : null}

        {step === "preview" && canCreateImports ? (
          <Card className="min-w-0 border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Validacion previa</CardTitle>
              <CardDescription>Mostrando las primeras {previewData.length} de {validRows.length} filas validas. Revisa el resultado antes de confirmar.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-auto p-0">
              <ImportsPreviewTable rows={previewData} />
            </CardContent>
            <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t bg-card/95 px-4 py-4 backdrop-blur sm:px-6">
                <Button variant="outline" onClick={() => setStep("map")}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
                <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                  {importMutation.isPending ? "Importando..." : `Confirmar importacion (${validRows.length} filas)`}
                </Button>
            </div>
          </Card>
        ) : null}

        {step === "done" && canCreateImports ? (
          <Card className="border-border/70 shadow-none">
            <CardContent className="space-y-4 py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Importacion completada</h2>
              <p className="text-muted-foreground">Las lineas fueron importadas. Revisa los pendientes en la seccion correspondiente.</p>
              <Button onClick={reset}>Nueva importacion</Button>
            </CardContent>
          </Card>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
