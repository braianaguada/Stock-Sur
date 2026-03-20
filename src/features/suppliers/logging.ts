import { SHOULD_LOG_SUPPLIER_IMPORT } from "@/features/suppliers/constants";

export function logSupplierImportError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  if (!SHOULD_LOG_SUPPLIER_IMPORT) return;

  if (error && typeof error === "object") {
    const err = error as { code?: string; message?: string; details?: string; hint?: string };
    console.error("[supplier-import]", {
      scope,
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint,
      ...extra,
    });
    return;
  }

  console.error("[supplier-import]", { scope, error, ...extra });
}
