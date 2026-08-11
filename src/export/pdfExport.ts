import { invoke } from "@tauri-apps/api/core";
import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import * as fontkit from "fontkit";
import bundledThaiFontUrl from "../assets/THSarabunNew.ttf?url";
import bundledThaiBoldFontUrl from "../assets/THSarabunNew-Bold.ttf?url";
import type {
  AppSettings,
  DigitalSigningOptions,
  ImportedDocument,
  WatermarkInstance,
} from "../types";
import { drawWatermarkToPdfPage } from "./renderWatermark";

/** Watermarked pages are rendered before being embedded in the exported PDF. */
export const WATERMARK_FLATTEN_DPI = 300;
const ascii = new TextEncoder();

function findBytes(haystack: Uint8Array, needle: Uint8Array, start = 0) {
  outer: for (let index = start; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function bangkokPdfDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `D:${value("year")}${value("month")}${value("day")}${value("hour")}${value("minute")}${value("second")}+07'00'`;
}

/** pdf-lib emits a UTC `Z` timestamp; PDF readers need the explicit +07:00 offset. */
function applyBangkokSigningTime(pdf: Uint8Array): Uint8Array {
  const byteRange = ascii.encode("/ByteRange");
  const dateStart = ascii.encode("/M (D:");
  const rangeIndex = findBytes(pdf, byteRange);
  const start = rangeIndex < 0 ? -1 : findBytes(pdf, dateStart, rangeIndex);
  if (start < 0) throw new Error("The PDF signature timestamp is missing.");
  const valueStart = start + "/M (".length;
  let valueEnd = valueStart;
  while (valueEnd < pdf.length && pdf[valueEnd] !== 0x29) valueEnd += 1;
  if (valueEnd === pdf.length) throw new Error("The PDF signature timestamp is malformed.");

  const replacement = ascii.encode(bangkokPdfDate());
  const result = new Uint8Array(pdf.length - (valueEnd - valueStart) + replacement.length);
  result.set(pdf.subarray(0, valueStart));
  result.set(replacement, valueStart);
  result.set(pdf.subarray(valueEnd), valueStart + replacement.length);
  return result;
}

type PageRasterizer = (
  sourceDocument: ImportedDocument,
  pageIndex: number,
  watermark: WatermarkInstance | null,
  signatureSvg: string | null,
  dpi: number,
) => Promise<Uint8Array>;

async function defaultPageRasterizer(
  ...arguments_: Parameters<PageRasterizer>
): Promise<Uint8Array> {
  // PDF.js requires browser canvas APIs. Loading it lazily keeps the export
  // preparation code usable in non-browser contexts such as unit tests.
  const { renderEasySamnaoPng } = await import("./pngExport");
  return renderEasySamnaoPng(...arguments_);
}

async function loadThaiFont(pdf: PDFDocument, settings: AppSettings) {
  const normalBytes = settings.fontPath
    ? new Uint8Array(
        await invoke<number[]>("read_font_bytes", { path: settings.fontPath }),
      )
    : new Uint8Array(await (await fetch(bundledThaiFontUrl)).arrayBuffer());
  const boldBytes = settings.fontPath
    ? normalBytes
    : new Uint8Array(await (await fetch(bundledThaiBoldFontUrl)).arrayBuffer());
  pdf.registerFontkit(fontkit as never);
  // Some Windows system fonts do not implement fontkit's subset encoder.
  // Embedding the complete local font is reliable and preserves Thai glyphs.
  try {
    return {
      normal: await pdf.embedFont(normalBytes, { subset: false }),
      bold: await pdf.embedFont(boldBytes, { subset: false }),
    };
  } catch {
    throw new Error(
      "The selected font could not be embedded. Choose a valid Thai-capable TTF or OTF font.",
    );
  }
}

function digitalSignatureRect(
  watermark: WatermarkInstance | undefined,
  page: { getWidth: () => number; getHeight: () => number },
): number[] {
  if (!watermark) return [0, 0, 0, 0];
  const width = Math.max(1, watermark.transform.width * page.getWidth());
  const height = Math.max(48, Math.min(page.getHeight(), width * 0.35));
  const centerX = watermark.transform.x * page.getWidth();
  const centerY = (1 - watermark.transform.y) * page.getHeight();
  return [
    Math.max(0, centerX - width / 2),
    Math.max(0, centerY - height / 2),
    Math.min(page.getWidth(), centerX + width / 2),
    Math.min(page.getHeight(), centerY + height / 2),
  ];
}

async function addFlattenedWatermarkedPage(
  output: PDFDocument,
  source: PDFDocument,
  document: ImportedDocument,
  pageIndex: number,
  watermark: WatermarkInstance,
  signatureSvg: string | null,
  settings: AppSettings,
  rasterize: PageRasterizer,
): Promise<void> {
  // Render a one-page staging PDF at 300 DPI, then embed that rendered page in
  // the output. This keeps the watermark inseparable from the page artwork,
  // unlike a separate PDF content stream that can be selectively removed.
  const staging = await PDFDocument.create();
  const [sourcePage] = await staging.copyPages(source, [pageIndex]);
  staging.addPage(sourcePage);
  const fonts = await loadThaiFont(staging, settings);
  await drawWatermarkToPdfPage(
    staging.getPage(0),
    fonts,
    watermark,
    signatureSvg,
  );

  const pageInfo = document.pages[pageIndex];
  const stagedDocument: ImportedDocument = {
    path: "",
    filename: document.filename,
    kind: "pdf",
    bytes: await staging.save(),
    pages: [{ ...pageInfo, index: 0 }],
  };
  const flattenedPage = await rasterize(
    stagedDocument,
    0,
    null,
    null,
    WATERMARK_FLATTEN_DPI,
  );
  const image = await output.embedPng(flattenedPage);
  const page = output.addPage([pageInfo.width, pageInfo.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
}

async function addVectorWatermarkedPage(
  output: PDFDocument,
  source: PDFDocument,
  pageIndex: number,
  watermark: WatermarkInstance,
  signatureSvg: string | null,
  settings: AppSettings,
): Promise<void> {
  const [page] = await output.copyPages(source, [pageIndex]);
  output.addPage(page);
  const fonts = await loadThaiFont(output, settings);
  await drawWatermarkToPdfPage(page, fonts, watermark, signatureSvg);
}

/** Unsigned watermarks are flattened; signed exports keep sharp vector artwork. */
export async function exportEasySamnaoPdf(
  document: ImportedDocument,
  pageIndexes: number[],
  watermarks: Record<number, WatermarkInstance>,
  signatureFor: (id: string | null) => Promise<string | null>,
  settings: AppSettings,
  digitalSigning?: DigitalSigningOptions,
  rasterize: PageRasterizer = defaultPageRasterizer,
): Promise<Uint8Array> {
  const exportedPageIndexes = [...new Set(pageIndexes)].sort(
    (first, second) => first - second,
  );
  if (!exportedPageIndexes.length)
    throw new Error("Select at least one page to export.");
  const source =
    document.kind === "pdf"
      ? await PDFDocument.load(document.bytes, {
          ignoreEncryption: false,
          updateMetadata: false,
        })
      : await PDFDocument.create();
  if (document.kind === "png") {
    const image = await source.embedPng(document.bytes);
    const page = source.addPage([
      document.pages[0].width,
      document.pages[0].height,
    ]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }
  const pdf = await PDFDocument.create();
  for (const pageIndex of exportedPageIndexes) {
    const watermark = watermarks[pageIndex];
    if (watermark) {
      const signatureSvg = await signatureFor(watermark.signatureId);
      if (digitalSigning) {
        await addVectorWatermarkedPage(
          pdf,
          source,
          pageIndex,
          watermark,
          signatureSvg,
          settings,
        );
      } else {
        await addFlattenedWatermarkedPage(
          pdf,
          source,
          document,
          pageIndex,
          watermark,
          signatureSvg,
          settings,
          rasterize,
        );
      }
    } else {
      const [sourcePage] = await pdf.copyPages(source, [pageIndex]);
      pdf.addPage(sourcePage);
    }
  }
  if (digitalSigning) {
    const outputPageIndex = Math.max(
      0,
      Math.min(
        pdf.getPageCount() - 1,
        exportedPageIndexes.indexOf(digitalSigning.pageIndex),
      ),
    );
    const page = pdf.getPage(outputPageIndex);
    pdflibAddPlaceholder({
      pdfDoc: pdf,
      pdfPage: page,
      reason: digitalSigning.reason,
      contactInfo: "",
      name: digitalSigning.signerName,
      location: digitalSigning.location,
      // CMS length varies by certificate chain. This allows standard Windows chains
      // without needing to reopen or alter the finished document after signing.
      signatureLength: 32_768,
      widgetRect: digitalSignatureRect(
        watermarks[digitalSigning.pageIndex],
        page,
      ),
      appName: "EasySamnao",
    });
  }
  // The signature dictionary itself is registered as a PDFInvalidObject by the
  // placeholder library, keeping its fixed-width byte range outside object streams.
  // Other objects can still use compression, which keeps signed PDFs compact.
  const prepared = await pdf.save({ useObjectStreams: true });
  return digitalSigning ? applyBangkokSigningTime(prepared) : prepared;
}
