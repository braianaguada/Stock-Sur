import { loadPdfJs } from "@/lib/lazy-vendors";

const MAX_EDGE = 2200;

const SERVICE_REMITO_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
type ServiceRemitoFileType = (typeof SERVICE_REMITO_FILE_TYPES)[number];

const SERVICE_REMITO_EXTENSION_TYPES: Record<string, ServiceRemitoFileType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function resolveServiceRemitoFileType(file: Pick<File, "name" | "type">): ServiceRemitoFileType | null {
  const reportedType = file.type.trim().toLowerCase();
  if (SERVICE_REMITO_FILE_TYPES.includes(reportedType as ServiceRemitoFileType)) {
    return reportedType as ServiceRemitoFileType;
  }
  const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
  return SERVICE_REMITO_EXTENSION_TYPES[extension] ?? null;
}

function getRenderScale(width: number, height: number) {
  const longestEdge = Math.max(width, height);
  return Math.min(MAX_EDGE / longestEdge, Math.max(1, 1600 / longestEdge));
}

function enhanceCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const luminances: number[] = [];
  for (let index = 0; index < image.data.length; index += 16) {
    luminances.push(Math.round(image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114));
  }
  luminances.sort((left, right) => left - right);
  const dark = luminances[Math.floor(luminances.length * 0.02)] ?? 0;
  const light = luminances[Math.floor(luminances.length * 0.98)] ?? 255;
  const range = Math.max(32, light - dark);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, ((gray - dark) * 255) / range));
    image.data[index] = contrasted;
    image.data[index + 1] = contrasted;
    image.data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? null;
}

async function enhancePdfFirstPage(file: File) {
  const { getDocument } = await loadPdfJs();
  const loadingTask = getDocument({ data: await file.arrayBuffer() });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: getRenderScale(baseViewport.width, baseViewport.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return enhanceCanvas(canvas, context);
  } finally {
    await pdf.destroy();
  }
}

export async function enhanceRemitoImage(file: File): Promise<string | null> {
  const mimeType = resolveServiceRemitoFileType(file);
  if (mimeType === "application/pdf") return enhancePdfFirstPage(file);
  if (!mimeType?.startsWith("image/") || typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = getRenderScale(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return enhanceCanvas(canvas, context);
  } finally {
    bitmap.close();
  }
}

export async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
  }
  return error instanceof Error ? error.message : "No se pudo importar el remito.";
}
