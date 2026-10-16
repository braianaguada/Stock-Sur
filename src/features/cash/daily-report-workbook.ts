import { DAILY_REPORT_HEADERS, type ReportRow } from "./daily-report";

/** SheetJS CE does not serialize cell borders; apply them to the generated OOXML. */
export async function dailyReportWorkbook(rows: ReportRow[]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([DAILY_REPORT_HEADERS, ...rows]);
  sheet["!cols"] = [14, 8, 9, 14, 18, 24].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(book, sheet, "Caja");
  const archive = XLSX.CFB.read(new Uint8Array(XLSX.write(book, { bookType: "xlsx", type: "array" })), { type: "array" });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stylesPath = "Root Entry/xl/styles.xml";
  const sheetPath = "Root Entry/xl/worksheets/sheet1.xml";
  const stylesEntry = XLSX.CFB.find(archive, stylesPath);
  const sheetEntry = XLSX.CFB.find(archive, sheetPath);
  const border = `<border>${["left", "right", "top", "bottom"].map((side) => `<${side} style="thin"><color rgb="FF000000"/></${side}>`).join("")}<diagonal/></border>`;
  let styles = decoder.decode(stylesEntry.content);
  if (!/<borders count="1">/.test(styles) || !/<cellXfs count="1">/.test(styles)) {
    throw new Error("No se pudo aplicar el formato de bordes al Excel.");
  }
  styles = styles.replace(/<borders count="1">([\s\S]*?)<\/borders>/, `<borders count="2">$1${border}</borders>`);
  styles = styles.replace(/<cellXfs count="1">([\s\S]*?)<\/cellXfs>/, (_, original: string) =>
    `<cellXfs count="2">${original}${original.replace('borderId="0"', 'borderId="1" applyBorder="1"')}</cellXfs>`);
  const worksheet = decoder.decode(sheetEntry.content).replace(/<c\b([^>]*?)>/g, (_, attributes: string) =>
    `<c${attributes.replace(/\s+s="\d+"/, "")} s="1">`);
  XLSX.CFB.utils.cfb_add(archive, stylesPath, encoder.encode(styles));
  XLSX.CFB.utils.cfb_add(archive, sheetPath, encoder.encode(worksheet));
  return new Uint8Array(XLSX.CFB.write(archive, { type: "buffer", fileType: "zip" }));
}
