import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PageContainer, PageHeader } from "@/components/ui/page";
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

export function SupplierExcelImport({ companyId, supplier, catalogs, onCancel, onImported }: {
  companyId: string;
  supplier: Supplier;
  catalogs: SupplierCatalog[];
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
  const [catalogId, setCatalogId] = useState("new");
  const [currency, setCurrency] = useState<ImportCurrency | "">("");
  const [format, setFormat] = useState<PriceFormat>("comma");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
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
  const included = preview.rows.filter((row) => !excluded.has(row.row));
  const invalidCount = included.filter((row) => row.errors.length).length;
  const pagination = usePaginationSlice({ items: preview.rows, page, pageSize: 25 });

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
    { id: "include", header: "Importar", cell: ({ row }) => <Checkbox aria-label={`Importar fila ${row.original.row}`} checked={!excluded.has(row.original.row)} disabled={Boolean(busy)} onCheckedChange={(checked) => setExcluded((current) => {
      const next = new Set(current); if (checked) next.delete(row.original.row); else next.add(row.original.row); return next;
    })} /> },
    { accessorKey: "row", header: "Fila Excel" },
    { accessorKey: "name", header: "Nombre" },
    { accessorKey: "unit", header: "Unidad" },
    { id: "price", header: "Precio sin IVA", cell: ({ row }) => row.original.price === null ? row.original.priceText || "Sin precio" : `${currency} ${row.original.price.toLocaleString("es-AR", { maximumFractionDigits: 6 })}` },
    { id: "validation", header: "Revisión", cell: ({ row }) => excluded.has(row.original.row) ? "Excluida por vos" : row.original.errors.length ? <span className="text-destructive">{row.original.errors.join(". ")}</span> : "Lista para importar" },
  ], [busy, currency, excluded]);

  const save = async () => {
    if (busy || !file || !currency || !title.trim() || preview.error || invalidCount || !included.length) return;
    setBusy("saving"); setError("");
    let versionId: string;
    try {
      versionId = await saveSupplierExcel({ companyId, supplierId: supplier.id, title, fileName: file.name, catalogId: catalogId === "new" ? null : catalogId, currency, rows: included });
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
    if (aliveRef.current) onImported(versionId);
  };

  return <PageContainer className="page-shell">
    <PageHeader title="Cargar lista de precios" eyebrow={supplier.name} actions={<Button variant="outline" disabled={Boolean(busy)} onClick={() => file ? setCancelOpen(true) : onCancel()}>Volver al proveedor</Button>} />
    <p className="text-sm text-muted-foreground">Elegí las columnas de nombre, unidad y precio. Todos los precios se guardan sin IVA, en la moneda de esta lista. Si la unidad está vacía, se usa «unidad».</p>
    <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-5 rounded-xl border bg-card p-4">
      <legend className="px-1 font-medium">1. Archivo y lista</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="supplier-excel">Archivo Excel (.xlsx o .xls, hasta 20 MB)</Label><Input id="supplier-excel" type="file" accept=".xlsx,.xls" onChange={(event) => { void selectFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />{file && <p className="text-sm">Archivo en revisión: {file.name}</p>}</div>
        <div className="space-y-2"><Label htmlFor="supplier-list-title">Nombre de la lista o versión</Label><Input id="supplier-list-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej.: Octubre contado" /></div>
        <ImportSelect id="supplier-list" label="Guardar como" value={catalogId} onChange={setCatalogId} options={[{ value: "new", label: "Nueva lista" }, ...catalogs.map((catalog) => ({ value: catalog.id, label: `Nueva versión de: ${catalog.title}` }))]} />
        <ImportSelect id="supplier-currency" label="Moneda de todos los precios" value={currency} onChange={(value) => { setCurrency(value as ImportCurrency); setExcluded(new Set()); }} options={[{ value: "ARS", label: "Pesos (ARS)" }, { value: "USD", label: "Dólares (USD)" }]} />
      </div>
      <p className="text-sm text-muted-foreground">No se suma IVA ni se convierte la moneda en esta carga. Una actualización crea una versión y conserva las anteriores.</p>
    </fieldset>
    {sheets.length > 0 && <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-5 rounded-xl border bg-card p-4">
      <legend className="px-1 font-medium">2. Hoja y columnas</legend>
      <div className="grid gap-4 md:grid-cols-3">
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
      <p className="text-sm" aria-live="polite">{preview.rows.length} filas · {included.length} seleccionadas · {invalidCount} con errores · {preview.rows.length - included.length} excluidas. Las filas completamente vacías se omiten.</p>
      <DataTable columns={columns} data={pagination.pagedItems} getRowId={(row) => String(row.row)} density="compact" emptyMessage="Seleccioná hoja, columnas y moneda para revisar los productos." />
      <DataTablePagination {...pagination} onPageChange={setPage} itemLabel="filas" />
      <p className="text-sm text-muted-foreground">Para corregir datos, editá el Excel y volvé a cargarlo. También podés desmarcar filas de forma explícita. No se importan filas inválidas ni se descartan automáticamente.</p>
    </section>
    {(error || preview.error) && <p role="alert" className="text-sm text-destructive">{error || preview.error}</p>}
    {busy && <p role="status" className="text-sm">{busy === "reading" ? "Leyendo Excel…" : "Guardando lista…"}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button onClick={() => void save()} disabled={Boolean(busy) || !file || !currency || !title.trim() || Boolean(preview.error) || invalidCount > 0 || !included.length}>Importar {included.length} productos sin IVA</Button></div>
    <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Descartar esta carga?</AlertDialogTitle><AlertDialogDescription>El archivo y las columnas seleccionadas todavía no se guardaron.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir revisando</AlertDialogCancel><AlertDialogAction onClick={onCancel}>Descartar y volver</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </PageContainer>;
}
