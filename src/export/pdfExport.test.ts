import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawWatermarkToPdfPage } from "./renderWatermark";
import { exportEasySamnaoPdf } from "./pdfExport";
import { createDefaultWatermark } from "../state/documentStore";
import { defaultSettings } from "../state/settingsStore";

describe("vector PDF watermark output", () => {
  it("exports only the selected source pages when no watermark is included", async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    source.addPage([595, 842]);
    const document = {
      path: "",
      filename: "test.pdf",
      kind: "pdf" as const,
      bytes: await source.save(),
      pages: [
        { index: 0, width: 595, height: 842, rotation: 0 },
        { index: 1, width: 595, height: 842, rotation: 0 },
      ],
    };
    const output = await exportEasySamnaoPdf(
      document,
      [1],
      {},
      async () => null,
      defaultSettings,
    );
    expect((await PDFDocument.load(output)).getPageCount()).toBe(1);
  });

  it("keeps a programmatic source page and adds vector watermark commands", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    page.drawText("Original vector content", { x: 50, y: 760 });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const watermark = createDefaultWatermark(defaultSettings);
    const englishPlan = {
      width: 1000,
      height: 300,
      elements: [
        {
          kind: "line" as const,
          x1: 50,
          y1: 30,
          x2: 950,
          y2: 30,
          strokeWidth: 5,
        },
        {
          kind: "text" as const,
          text: "EasySamnao",
          x: 500,
          y: 130,
          fontSize: 64,
          weight: "bold" as const,
          align: "center" as const,
          role: "heading" as const,
        },
      ],
    };
    await drawWatermarkToPdfPage(
      page,
      { normal: font, bold: font },
      watermark,
      null,
      englishPlan,
    );
    const output = await PDFDocument.load(await pdf.save());
    expect(output.getPageCount()).toBe(1);
    expect((await pdf.save()).length).toBeGreaterThan(100);
  });

  it("flattens a watermarked page into a rendered image before export", async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    const document = {
      path: "",
      filename: "test.pdf",
      kind: "pdf" as const,
      bytes: await source.save(),
      pages: [{ index: 0, width: 595, height: 842, rotation: 0 }],
    };
    const fontBytes = await readFile(
      resolve(process.cwd(), "src/assets/THSarabunNew.ttf"),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(fontBytes);
    const png = new Uint8Array(
      await readFile(resolve(process.cwd(), "src/assets/easysamnao-icon.png")),
    );
    let rasterizedAt = 0;

    try {
      const output = await exportEasySamnaoPdf(
        document,
        [0],
        { 0: createDefaultWatermark(defaultSettings) },
        async () => null,
        defaultSettings,
        undefined,
        async (_stagedDocument, _pageIndex, _watermark, _signature, dpi) => {
          rasterizedAt = dpi;
          return png;
        },
      );
      const flattened = await PDFDocument.load(output);
      expect(rasterizedAt).toBe(300);
      expect(flattened.getPageCount()).toBe(1);
      expect(flattened.getPage(0).getSize()).toEqual({
        width: 595,
        height: 842,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("records a digital-signature timestamp with the Bangkok GMT+7 offset", async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    const output = await exportEasySamnaoPdf(
      {
        path: "",
        filename: "test.pdf",
        kind: "pdf",
        bytes: await source.save(),
        pages: [{ index: 0, width: 595, height: 842, rotation: 0 }],
      },
      [0],
      {},
      async () => null,
      defaultSettings,
      {
        certificateId: "certificate",
        signerName: "Test signer",
        reason: "Test",
        location: "Bangkok",
        pageIndex: 0,
      },
    );
    const text = new TextDecoder().decode(output);
    expect(text).toMatch(/\/M \(D:\d{14}\+07'00'\)/);
  });
});
