export async function downloadHtmlAsPdf(html: string, fileName: string) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  parsed.querySelectorAll(".print-action").forEach((element) => element.remove());

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.innerHTML = `${parsed.head.querySelector("style")?.outerHTML ?? ""}${parsed.body.innerHTML}`;
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
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(container)
      .save();
  } finally {
    container.remove();
  }
}
