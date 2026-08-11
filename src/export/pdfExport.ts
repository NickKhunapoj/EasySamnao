import { invoke } from "@tauri-apps/api/core";
import { PDFDocument } from "pdf-lib";
import * as fontkit from "fontkit";
import bundledThaiFontUrl from "../assets/THSarabunNew.ttf?url";
import bundledThaiBoldFontUrl from "../assets/THSarabunNew-Bold.ttf?url";
import type { AppSettings, ImportedDocument, WatermarkInstance } from "../types";
import { drawWatermarkToPdfPage } from "./renderWatermark";

async function loadThaiFont(pdf: PDFDocument, settings: AppSettings) {
  const normalBytes = settings.fontPath
    ? new Uint8Array(await invoke<number[]>("read_font_bytes", { path: settings.fontPath }))
    : new Uint8Array(await (await fetch(bundledThaiFontUrl)).arrayBuffer());
  const boldBytes = settings.fontPath
    ? normalBytes
    : new Uint8Array(await (await fetch(bundledThaiBoldFontUrl)).arrayBuffer());
  pdf.registerFontkit(fontkit as never);
  // Some Windows system fonts do not implement fontkit's subset encoder.
  // Embedding the complete local font is reliable and preserves Thai glyphs.
  try { return { normal: await pdf.embedFont(normalBytes, { subset: false }), bold: await pdf.embedFont(boldBytes, { subset: false }) }; }
  catch { throw new Error("The selected font could not be embedded. Choose a valid Thai-capable TTF or OTF font."); }
}

export async function exportEasySamnaoPdf(document: ImportedDocument, pageIndexes: number[], watermarks: Record<number, WatermarkInstance>, signatureFor: (id: string | null) => Promise<string | null>, settings: AppSettings): Promise<Uint8Array> {
  const exportedPageIndexes = [...new Set(pageIndexes)].sort((first, second) => first - second);
  if (!exportedPageIndexes.length) throw new Error("Select at least one page to export.");
  const pdf = document.kind === "pdf"
    ? await PDFDocument.load(document.bytes, { ignoreEncryption: false, updateMetadata: false })
    : await PDFDocument.create();
  if (document.kind === "pdf") {
    for (let index = pdf.getPageCount() - 1; index >= 0; index -= 1) {
      if (!exportedPageIndexes.includes(index)) pdf.removePage(index);
    }
  }
  if (document.kind === "png") {
    const source = await pdf.embedPng(document.bytes);
    const page = pdf.addPage([document.pages[0].width, document.pages[0].height]);
    page.drawImage(source, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  const hasWatermark = exportedPageIndexes.some((index) => watermarks[index]);
  const font = hasWatermark ? await loadThaiFont(pdf, settings) : null;
  for (let outputIndex = 0; outputIndex < exportedPageIndexes.length; outputIndex += 1) {
    const watermark = watermarks[exportedPageIndexes[outputIndex]];
    if (watermark && font) await drawWatermarkToPdfPage(pdf.getPage(outputIndex), font, watermark, await signatureFor(watermark.signatureId));
  }
  return pdf.save({ useObjectStreams: true });
}
