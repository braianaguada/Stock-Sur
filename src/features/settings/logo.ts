const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export function validateCompanyLogo(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "El archivo seleccionado debe ser una imagen.";
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return "El logo no puede superar los 5 MB.";
  }

  return null;
}

export function getVersionedPublicUrl(publicUrl: string, version: number): string {
  const separator = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${separator}v=${version}`;
}
