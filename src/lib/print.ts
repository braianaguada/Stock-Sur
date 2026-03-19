const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function escapeHtmlWithLineBreaks(value: unknown) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

export function openPrintWindow(html: string, features?: string) {
  const win = window.open("", "_blank", features);
  if (!win) return null;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  return win;
}
