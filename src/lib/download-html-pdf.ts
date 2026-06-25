export async function downloadHtmlAsPdf(html: string, fileName: string) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  parsed.querySelectorAll(".print-action").forEach((element) => element.remove());

  const existingCanvasContainers = new Set(document.querySelectorAll(".html2canvas-container"));
  const container = document.createElement("div");
  const printStyle = parsed.head.querySelector("style")?.cloneNode(true) as HTMLStyleElement | null;
  if (printStyle) printStyle.dataset.pdfPrintStyle = "true";
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "#ffffff";
  container.style.color = "#0f172a";
  if (printStyle) container.appendChild(printStyle);
  const content = document.createElement("div");
  content.innerHTML = parsed.body.innerHTML;
  container.appendChild(content);
  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(images.map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })));

    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf()
      .set({
        margin: 0,
        filename: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (clonedDocument: Document) => {
            clonedDocument.querySelectorAll('link[rel="stylesheet"], style:not([data-pdf-print-style="true"])')
              .forEach((element) => element.remove());
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(container)
      .save();
  } finally {
    container.remove();
    document.querySelectorAll(".html2canvas-container").forEach((element) => {
      if (!existingCanvasContainers.has(element)) element.remove();
    });
  }
}
