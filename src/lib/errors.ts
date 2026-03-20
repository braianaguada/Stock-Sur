export function getErrorMessage(error: unknown, fallback = "Error desconocido") {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error && typeof error.message === "string" ? error.message : "";
    const maybeDetails = "details" in error && typeof error.details === "string" ? error.details : "";
    const maybeHint = "hint" in error && typeof error.hint === "string" ? error.hint : "";

    return [maybeMessage, maybeDetails, maybeHint].filter(Boolean).join(" - ") || fallback;
  }

  return fallback;
}
