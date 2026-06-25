const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const PRINT_FAVICON_TAG = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
export const PRINT_BRAND_MARK = '<img src="/favicon.svg" alt="Stock Sur" />';

export function withPrintFavicon(html: string) {
  if (html.includes('href="/favicon.svg"')) return html;
  return html.replace("</head>", `${PRINT_FAVICON_TAG}</head>`);
}

export function withPrintDialogOnLoad(html: string) {
  const script = "<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print()},250)},{once:true})</script>";
  return html.includes("</body>") ? html.replace("</body>", `${script}</body>`) : `${html}${script}`;
}

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
  win.document.write(withPrintFavicon(html));
  win.document.close();
  win.focus();

  return win;
}
