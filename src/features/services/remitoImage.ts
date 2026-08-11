const MAX_EDGE = 2200;

export async function enhanceRemitoImage(file: File): Promise<string | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(MAX_EDGE / Math.max(bitmap.width, bitmap.height), Math.max(1, 1600 / Math.max(bitmap.width, bitmap.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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

export function isRetryableFunctionError(error: unknown) {
  const status = (error as { context?: { status?: unknown } } | null)?.context?.status;
  return typeof status !== "number" || status === 408 || status === 429 || status >= 500;
}
