import { invoke } from "@tauri-apps/api/core";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import type { ImportedDocument, PageInfo } from "../types";

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || "document";
}

export async function readLocalBytes(path: string): Promise<Uint8Array> {
  const bytes = await invoke<number[]>("read_selected_file", { path });
  return new Uint8Array(bytes);
}

async function imageSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The PNG could not be decoded."));
      element.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

export async function loadPdf(bytes: Uint8Array): Promise<{ pdf: PDFDocumentProxy; pages: PageInfo[] }> {
  try {
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    const pages: PageInfo[] = [];
    for (let index = 0; index < pdf.numPages; index += 1) {
      const page = await pdf.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({ index, width: viewport.width, height: viewport.height, rotation: page.rotate });
    }
    return { pdf, pages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF error";
    if (/password|encrypted/i.test(message)) throw new Error("This PDF is password-protected. Please use an unencrypted copy.");
    throw new Error(`The PDF could not be imported: ${message}`);
  }
}

/** PDF.js 6 owns worker teardown on the loading task, not PDFDocumentProxy. */
export async function disposePdf(pdf: PDFDocumentProxy): Promise<void> {
  await pdf.loadingTask.destroy();
}

export async function createImportedDocument(path: string, bytes?: Uint8Array, filename?: string): Promise<ImportedDocument> {
  const content = bytes ?? await readLocalBytes(path);
  const name = filename ?? filenameFromPath(path);
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { pdf, pages } = await loadPdf(content);
    await disposePdf(pdf);
    return { path, filename: name, kind: "pdf", bytes: content, pages };
  }
  if (lower.endsWith(".png")) {
    const size = await imageSize(content);
    return { path, filename: name, kind: "png", bytes: content, pages: [{ index: 0, ...size, rotation: 0 }] };
  }
  throw new Error("Please choose a PDF or PNG file.");
}

export async function createImportedDocumentFromFile(file: File): Promise<ImportedDocument> {
  return createImportedDocument("", new Uint8Array(await file.arrayBuffer()), file.name);
}
