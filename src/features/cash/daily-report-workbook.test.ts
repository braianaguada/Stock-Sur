import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { dailyReportWorkbook } from "./daily-report-workbook";

describe("daily report Excel borders", () => {
  it("serializes borders on every cell, including empty invoice numbers, and preserves numeric amounts", async () => {
    const bytes = await dailyReportWorkbook([["FACTURA", "B", 9, "", 270000, "MP. POINT"]]);
    const archive = XLSX.CFB.read(bytes, { type: "array" });
    const xml = (path: string) => new TextDecoder().decode(XLSX.CFB.find(archive, `Root Entry/xl/${path}`).content);
    const styles = new DOMParser().parseFromString(xml("styles.xml"), "application/xml");
    const sheet = new DOMParser().parseFromString(xml("worksheets/sheet1.xml"), "application/xml");
    expect(styles.querySelectorAll('border [style="thin"]')).toHaveLength(4);
    expect(styles.querySelector('cellXfs xf[borderId="1"][applyBorder="1"]')).not.toBeNull();
    expect(sheet.querySelectorAll('c[s="1"]')).toHaveLength(12);
    const book = XLSX.read(bytes, { type: "array" });
    expect(XLSX.utils.sheet_to_json(book.Sheets.Caja, { header: 1 })).toEqual([
      ["TIPO", "LETRA", "P.VTA", "N°", "IMPORTE", "F.PAGO"], ["FACTURA", "B", 9, "", 270000, "MP. POINT"],
    ]);
  });
});
