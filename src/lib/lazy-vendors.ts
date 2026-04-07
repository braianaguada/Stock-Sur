type XlsxModule = typeof import("xlsx");
type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type TesseractModule = typeof import("tesseract.js");

let xlsxModulePromise: Promise<XlsxModule> | null = null;
let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let tesseractModulePromise: Promise<TesseractModule> | null = null;

export async function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
}

export async function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return module;
    });
  }
  return pdfJsModulePromise;
}

export async function loadTesseract() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import("tesseract.js");
  }
  return tesseractModulePromise;
}
