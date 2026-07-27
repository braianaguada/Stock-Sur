export function getPublicAppOrigin() {
  const buildOrigin = typeof __PUBLIC_APP_URL__ === "string" ? __PUBLIC_APP_URL__ : "";
  const configuredOrigin = buildOrigin || import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configuredOrigin) return configuredOrigin.replace(/\/+$/, "");

  return window.location.origin;
}
