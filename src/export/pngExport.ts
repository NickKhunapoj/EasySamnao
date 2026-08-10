import { getDocument } from "pdfjs-dist";
import type { ImportedDocument, WatermarkInstance } from "../types";
import { drawWatermarkToCanvas } from "./renderWatermark";

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function checkSize(width: number, height: number): void {
  if (width * height > 90_000_000 || width > 16_384 || height > 16_384) throw new Error("This export resolution is too large for safe memory use. Choose a lower DPI.");
}

export async function renderEasySamnaoPng(sourceDocument: ImportedDocument, pageIndex: number, watermark: WatermarkInstance, signatureSvg: string | null, dpi: number): Promise<Uint8Array> {
  const canvas = window.document.createElement("canvas");
  if (sourceDocument.kind === "pdf") {
    const pdf = await getDocument({ data: sourceDocument.bytes.slice() }).promise;
    try {
      const page = await pdf.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: dpi / 72 });
      checkSize(Math.ceil(viewport.width), Math.ceil(viewport.height));
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Unable to create a PNG export canvas.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    } finally { await pdf.loadingTask.destroy(); }
  } else {
    const scale = dpi / 96;
    checkSize(Math.ceil(sourceDocument.pages[0].width * scale), Math.ceil(sourceDocument.pages[0].height * scale));
    canvas.width = Math.ceil(sourceDocument.pages[0].width * scale); canvas.height = Math.ceil(sourceDocument.pages[0].height * scale);
    const source = new Image();
    const url = URL.createObjectURL(new Blob([sourceDocument.bytes], { type: "image/png" }));
    await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error("The source PNG could not be decoded.")); source.src = url; });
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
  }
  await drawWatermarkToCanvas(canvas, watermark, signatureSvg);
  return canvasBlob(canvas);
}
