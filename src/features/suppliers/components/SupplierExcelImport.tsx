import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { invalidateSupplierCatalogQueries } from "@/lib/invalidate";
import { readSupplierExcel, previewSupplierSheet, type ImportCurrency, type PriceFormat, type SupplierPreviewRow, type SupplierSheet } from "../excelImport";
import { saveSupplierExcel } from "../excelImportGateway";
import type { Supplier, SupplierCatalog } from "../types";

function ImportSelect({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Elegí una opción" /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function SupplierExcelImport({ companyId, supplier, catalogs, catalogsLoading = false, catalogsError, onRetryCatalogs, onCancel, onImported }: {
  companyId: string;
  supplier: Supplier;
  catalogs: SupplierCatalog[];
  catalogsLoading?: boolean;
  catalogsError?: Error | null;
  onRetryCatalogs?: () => void;
  onCancel: () => void;
  onImported: (versionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SupplierSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState("0");
  const [header, setHeader] = useState("1");
  const [nameColumn, setNameColumn] = useState("");
  const [unitColumn, setUnitColumn] = useState("none");
  const [priceColumn, setPriceColumn] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"new" | "replace">("new");
  const [catalogId, setCatalogId] = useState("");
  const [currency, setCurrency] = useState<ImportCurrency | "">("");
  const [format, setFormat] = useState<PriceFormat>("comma");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const requestRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; requestRef.current += 1; };
  }, []);
  useEffect(() => {
    if (!file) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [file]);

  const selectedCatalog = catalogs.find((catalog) => catalog.id === catalogId);
  const listTitle = mode === "replace" ? selectedCatalog?.title ?? "" : title;
  const requestClose = () => {
    if (busy) return;
    if (file) setCancelOpen(true); else onCancel();
  };
  const sheet = sheets[Number(sheetIndex)];
  const headerNumber = Number(header);
  const columnOptions = useMemo(() => {
    const width = sheet?.rows.reduce((max, row) => Math.max(max, row.length), 0) ?? 0;
    return Array.from({ length: width }, (_, index) => ({
      value: String(index),
      label: `Col. ${index + 1}: ${String(sheet?.rows[headerNumber - 1]?.[index] || "Sin título").slice(0, 70)}`,
    }));
  }, [sheet, headerNumber]);
  const preview = useMemo(() => {
    if (!sheet || !nameColumn || !priceColumn || !currency) return { rows: [], error: "" };
    try {
      return { rows: previewSupplierSheet(sheet, headerNumber, { name: Number(nameColumn), unit: unitColumn === "none" ? null : Number(unitColumn), price: Number(priceColumn) }, format, currency), error: "" };
    } catch (cause) { return { rows: [], error: (cause as Error).message }; }
  }, [sheet, headerNumber, nameColumn, unitColumn, priceColumn, format, currency]);
  const included = preview.rows.filter((row) => !row.errors.length && !excluded.has(row.row));
  const invalidCount = preview.rows.filter((row) => row.errors.length).length;
  const pagination = usePaginationSlice({ items: onlyErrors ? preview.rows.filter((row) => row.errors.length) : preview.rows, page, pageSize: 25 });

  const resetMapping = () => {
    setNameColumn(""); setUnitColumn("none"); setPriceColumn(""); setExcluded(new Set()); setPage(1); setError("");
  };
  const selectFile = async (selected: File | null) => {
    if (!selected || busy) return;
    const request = ++requestRef.current;
    setBusy("reading"); setError("");
    try {
      const result = await readSupplierExcel(selected);
      if (!aliveRef.current || request !== requestRef.current) return;
      setFile(selected); setSheets(result); setSheetIndex(String(Math.max(0, result.findIndex((item) => item.rows.length))));
      setHeader("1"); resetMapping();
      setTitle(selected.name.replace(/\.xlsx?$/i, ""));
    } catch (cause) {
      if (aliveRef.current && request === requestRef.current) setError(cause instanceof Error ? cause.message : "No se pudo leer el Excel. Verificá que el archivo sea válido.");
    } finally {
      if (aliveRef.current && request === requestRef.current) setBusy(null);
    }
  };
  const columns = useMemo<ColumnDef<SupplierPreviewRow, unknown>[]>(() => [
    { id: "include", header: "Importar", cell: ({ row }) => <Checkbox aria-label={`Importar fila ${row.original.row}`} checked={!row.original.errors.length && !excluded.has(row.original.row)} disabled={Boolean(busy) || Boolean(row.original.errors.length)} onCheckedChange={(checked) => setExcluded((current) => {
      const next = new Set(current); if (checked) next.delete(row.original.row); else next.add(row.original.row); return next;
    })} /> },
    { accessorKey: "row", header: "Fila Excel" },
    { accessorKey: "name", header: "Nombre" },
    { accessorKey: "unit", header: "Unidad" },
    { id: "price", header: "Precio sin IVA", cell: ({ row }) => row.original.price === null ? row.original.priceText || "Sin precio" : `${currency} ${row.original.price.toLocaleString("es-AR", { maximumFractionDigits: 6 })}` },
    { id: "validation", header: "Revisión", cell: ({ row }) => excluded.has(row.original.row) ? "Excluida por vos" : row.original.errors.length ? <span className="text-destructive">{row.original.errors.join(". ")}</span> : "Lista para importar" },
  ], [busy, currency, excluded]);

  const save = async () => {
    if (busy || !file || !currency || !listTitle.trim() || (mode === "replace" && !selectedCatalog) || preview.error || !included.length) return;
    setBusy("saving"); setError("");
    let versionId: string;
    try {
      versionId = await saveSupplierExcel({ companyId, supplierId: supplier.id, title: listTitle, fileName: file.name, catalogId: mode === "new" ? null : catalogId, currency, rows: included });
    } catch (cause) {
      if (aliveRef.current) {
        const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "Revisá tu conexión y permisos.";
        setError(`No se pudo confirmar la importación: ${message} Si se cortó la conexión, revisá el historial antes de reintentar.`);
        setBusy(null);
      }
      return;
    }
    // A cache refresh failure must not turn a completed import into a retry/duplicate.
    await invalidateSupplierCatalogQueries(queryClient, { companyId, supplierId: supplier.id, versionId }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ["supplier-comparison-versions", companyId] }).catch(() => undefined);
    if (aliveRef.current) onImported(versionId);
  };

  return <>
    <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent variant="command" className="flex flex-col overflow-hidden" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Subir lista de precios</DialogTitle>
          <DialogDescription>{supplier.name} · Creá una lista o reemplazá los precios de una existente.</DialogDescription>
        </DialogHeader>
        <DialogBody className="-mx-1 space-y-6 px-1">
    <p className="text-sm text-muted-foreground">Elegí las columnas de nombre, unidad y precio. Todos los precios se guardan sin IVA, en la moneda de esta lista. Si la unidad está vacía, se usa «unidad».</p>
    <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-4">
      <legend className="px-1 font-medium">1. Archivo y lista</legend>
      <div role="radiogroup" aria-label="Destino de la carga" className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="radio" name="supplier-import-mode" value="new" checked={mode === "new"} onChange={() => setMode("new")} className="accent-primary" />
          <span className="text-sm font-medium">Nueva lista</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          <input type="radio" name="supplier-import-mode" value="replace" checked={mode === "replace"} disabled={!catalogs.length} onChange={() => setMode("replace")} className="accent-primary" />
          <span className="text-sm font-medium">Reemplazar existente</span>
        </label>
      </div>
      {mode === "replace" && <ImportSelect id="supplier-list" label="Lista que querés reemplazar" value={catalogId} onChange={setCatalogId} options={catalogs.map((catalog) => ({ value: catalog.id, label: catalog.title }))} />}
      {catalogsLoading ? <p role="status" className="text-sm text-muted-foreground">Cargando listas del proveedor…</p> : catalogsError ? <p role="alert" className="text-sm text-destructive">No se pudieron cargar las listas: {catalogsError.message} <Button variant="link" onClick={onRetryCatalogs}>Reintentar</Button></p> : !catalogs.length && <p className="text-sm text-muted-foreground">Este proveedor todavía no tiene listas para reemplazar.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="supplier-excel">Archivo Excel (.xlsx o .xls, hasta 20 MB)</Label><Input id="supplier-excel" type="file" accept=".xlsx,.xls" onChange={(event) => { void selectFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />{file && <p className="text-sm">Archivo en revisión: {file.name}</p>}</div>
        {mode === "new" && <div className="space-y-2"><Label htmlFor="supplier-list-title">Nombre de la lista</Label><Input id="supplier-list-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej.: Octubre contado" /></div>}
        <ImportSelect id="supplier-currency" label="Moneda de todos los precios" value={currency} onChange={(value) => { setCurrency(value as ImportCurrency); setExcluded(new Set()); }} options={[{ value: "ARS", label: "Pesos (ARS)" }, { value: "USD", label: "Dólares (USD)" }]} />
      </div>
      <p className="text-sm text-muted-foreground">Los precios se guardan sin IVA en su moneda original. Al reemplazar una lista se conserva su nombre y se muestran los nuevos precios. Las órdenes anteriores conservan sus datos.</p>
    </fieldset>
    {sheets.length > 0 && <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-4">
      <legend className="px-1 font-medium">2. Hoja y columnas</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImportSelect id="supplier-sheet" label="Hoja del Excel" value={sheetIndex} onChange={(value) => { setSheetIndex(value); setHeader("1"); resetMapping(); }} options={sheets.map((item, index) => ({ value: String(index), label: item.name }))} />
        <div className="space-y-2"><Label htmlFor="supplier-header">Fila que contiene los encabezados</Label><Input id="supplier-header" type="number" min={1} max={sheet?.rows.length || 1} value={header} onChange={(event) => { setHeader(event.target.value); resetMapping(); }} /></div>
        <ImportSelect id="supplier-price-format" label="Formato de precios escritos como texto" value={format} onChange={(value) => { setFormat(value as PriceFormat); setExcluded(new Set()); }} options={[{ value: "comma", label: "1.234,56 (coma decimal)" }, { value: "dot", label: "1,234.56 (punto decimal)" }]} />
        <ImportSelect id="supplier-name-column" label="Columna: nombre (obligatoria)" value={nameColumn} onChange={(value) => { setNameColumn(value); setExcluded(new Set()); }} options={columnOptions} />
        <ImportSelect id="supplier-unit-column" label="Columna: unidad" value={unitColumn} onChange={(value) => { setUnitColumn(value); setExcluded(new Set()); }} options={[{ value: "none", label: "No hay columna: usar unidad" }, ...columnOptions]} />
        <ImportSelect id="supplier-price-column" label="Columna: precio sin IVA (obligatoria)" value={priceColumn} onChange={(value) => { setPriceColumn(value); setExcluded(new Set()); }} options={columnOptions} />
      </div>
      <p className="text-sm text-muted-foreground">Los números reales de Excel conservan su valor. El formato elegido solo se aplica a precios guardados como texto. Las filas anteriores al encabezado no se importan.</p>
    </fieldset>}
    <section aria-label="Vista previa de importación" className="min-w-0 space-y-3">
      <h2 className="font-medium">3. Revisar e importar</h2>
      <p className="text-sm" aria-live="polite">{preview.rows.length} filas visibles · {included.length} seleccionadas · {invalidCount} con errores · {preview.rows.length - included.length} excluidas. Se omiten las filas vacías y las ocultas en Excel ({sheet?.hiddenRows?.filter((row) => row > headerNumber).length ?? 0}).</p>
      <Button variant="outline" disabled={Boolean(busy)} aria-pressed={onlyErrors} onClick={() => { setOnlyErrors((value) => !value); setPage(1); }}>{onlyErrors ? "Ver todas las filas" : `Ver filas con errores (${invalidCount})`}</Button>
      <DataTable columns={columns} data={pagination.pagedItems} getRowId={(row) => String(row.row)} density="compact" emptyMessage="Seleccioná hoja, columnas y moneda para revisar los productos." />
      <DataTablePagination {...pagination} onPageChange={setPage} itemLabel="filas" />
      <p className="text-sm text-muted-foreground">Las filas con errores quedan deseleccionadas y muestran el motivo. Podés importar las válidas y corregir las otras en el Excel para una nueva carga. También podés desmarcar productos que no quieras importar.</p>
    </section>
    {(error || preview.error) && <p role="alert" className="text-sm text-destructive">{error || preview.error}</p>}
    {busy && <p role="status" className="text-sm">{busy === "reading" ? "Leyendo Excel…" : "Guardando lista…"}</p>}
        </DialogBody>
        <DialogFooter className="shrink-0 gap-2 border-t pt-4">
          <Button variant="outline" disabled={Boolean(busy)} onClick={requestClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={Boolean(busy) || catalogsLoading || Boolean(catalogsError) || !file || !currency || !listTitle.trim() || Boolean(preview.error) || !included.length}>{"Importar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Descartar esta carga?</AlertDialogTitle><AlertDialogDescription>El archivo y las columnas seleccionadas todavía no se guardaron.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir revisando</AlertDialogCancel><AlertDialogAction onClick={onCancel}>Descartar y volver</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
