import { GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSource;

export async function renderPdfPage(pdf: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, scale: number): Promise<void> {
  const page = await pdf.getPage(index + 1);
  const viewport = page.getViewport({ scale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(viewport.width * outputScale);
  canvas.height = Math.ceil(viewport.height * outputScale);
  canvas.style.width = `${Math.ceil(viewport.width)}px`;
  canvas.style.height = `${Math.ceil(viewport.height)}px`;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Your graphics system cannot create a preview canvas.");
  await page.render({ canvas, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0] }).promise;
}
