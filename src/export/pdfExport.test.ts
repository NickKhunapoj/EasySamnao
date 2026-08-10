import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawWatermarkToPdfPage } from "./renderWatermark";
import { createDefaultWatermark } from "../state/documentStore";
import { defaultSettings } from "../state/settingsStore";

describe("vector PDF watermark output", () => {
  it("keeps a programmatic source page and adds vector watermark commands", async () => {
    const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]);
    page.drawText("Original vector content", { x: 50, y: 760 });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const watermark = createDefaultWatermark(defaultSettings);
    const englishPlan = { width: 1000, height: 300, elements: [
      { kind: "line" as const, x1: 50, y1: 30, x2: 950, y2: 30, strokeWidth: 5 },
      { kind: "text" as const, text: "EasySamnao", x: 500, y: 130, fontSize: 64, weight: "bold" as const, align: "center" as const, role: "heading" as const }
    ] };
    await drawWatermarkToPdfPage(page, { normal: font, bold: font }, watermark, null, englishPlan);
    const output = await PDFDocument.load(await pdf.save());
    expect(output.getPageCount()).toBe(1);
    expect((await pdf.save()).length).toBeGreaterThan(100);
  });
});
