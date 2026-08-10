import { degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { WatermarkInstance } from "../types";
import { buildTemplatePlan } from "../templates/plan";
import type { TemplatePlan } from "../templates/types";
import { colorToPdf } from "../utils/color";
import { normalizedToPdfTransform, rotatePdfVector } from "../utils/coordinates";
import { rasterizeSignatureSvg } from "../signatures/rasterizeSignature";

async function svgToPng(svg: string, color?: string): Promise<Uint8Array> {
  const canvas = await rasterizeSignatureSvg(svg, color, 1600);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Unable to encode the signature.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function worldPoint(localX: number, localY: number, planWidth: number, planHeight: number, scale: number, centerX: number, centerY: number, rotation: number): { x: number; y: number } {
  const vector = rotatePdfVector((localX - planWidth / 2) * scale, -(localY - planHeight / 2) * scale, rotation);
  return { x: centerX + vector.x, y: centerY + vector.y };
}

export interface WatermarkFonts { normal: PDFFont; bold: PDFFont; }

export async function drawWatermarkToPdfPage(page: PDFPage, fonts: WatermarkFonts, watermark: WatermarkInstance, signatureSvg: string | null, planOverride?: TemplatePlan): Promise<void> {
  const plan = planOverride ?? buildTemplatePlan(watermark);
  const transform = normalizedToPdfTransform(watermark.transform, page.getSize());
  const scale = transform.width / plan.width;
  const opacity = watermark.style.opacity;
  const parsedTextColor = colorToPdf(watermark.style.textColor);
  const parsedLineColor = colorToPdf(watermark.style.lineColor);
  const textColor = rgb(parsedTextColor.r, parsedTextColor.g, parsedTextColor.b);
  const lineColor = rgb(parsedLineColor.r, parsedLineColor.g, parsedLineColor.b);
  const signatureBytes = signatureSvg ? await svgToPng(signatureSvg) : null;
  const signatureImage = signatureBytes ? await page.doc.embedPng(signatureBytes) : null;

  for (const element of plan.elements) {
    if (element.kind === "line") {
      const start = worldPoint(element.x1, element.y1, plan.width, plan.height, scale, transform.centerX, transform.centerY, transform.rotation);
      const end = worldPoint(element.x2, element.y2, plan.width, plan.height, scale, transform.centerX, transform.centerY, transform.rotation);
      page.drawLine({ start, end, thickness: element.strokeWidth * scale, color: lineColor, opacity });
    } else if (element.kind === "text") {
      const font = element.weight === "bold" ? fonts.bold : fonts.normal;
      const size = element.fontSize * scale;
      const textWidth = font.widthOfTextAtSize(element.text, size);
      const localX = element.align === "center" ? element.x - textWidth / (2 * scale) : element.x;
      const point = worldPoint(localX, element.y, plan.width, plan.height, scale, transform.centerX, transform.centerY, transform.rotation);
      page.drawText(element.text, { x: point.x, y: point.y - size * 0.33, size, font, color: textColor, opacity, rotate: degrees(transform.rotation) });
    } else if (signatureImage) {
      const lowerLeft = worldPoint(element.x, element.y + element.height, plan.width, plan.height, scale, transform.centerX, transform.centerY, transform.rotation);
      page.drawImage(signatureImage, { x: lowerLeft.x, y: lowerLeft.y, width: element.width * scale, height: element.height * scale, opacity, rotate: degrees(transform.rotation) });
    }
  }
}

export async function drawWatermarkToCanvas(canvas: HTMLCanvasElement, watermark: WatermarkInstance, signatureSvg: string | null): Promise<void> {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create an export canvas.");
  const plan = buildTemplatePlan(watermark);
  const width = watermark.transform.width * canvas.width;
  const scale = width / plan.width;
  context.save();
  context.globalAlpha = watermark.style.opacity;
  context.translate(watermark.transform.x * canvas.width, watermark.transform.y * canvas.height);
  context.rotate((watermark.transform.rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.translate(-plan.width / 2, -plan.height / 2);
  for (const element of plan.elements) {
    if (element.kind === "line") {
      context.strokeStyle = watermark.style.lineColor;
      context.lineWidth = element.strokeWidth;
      context.beginPath(); context.moveTo(element.x1, element.y1); context.lineTo(element.x2, element.y2); context.stroke();
    } else if (element.kind === "text") {
      context.fillStyle = watermark.style.textColor;
      context.font = `${element.weight === "bold" ? "700" : "400"} ${element.fontSize}px "TH Sarabun New", "Noto Sans Thai", "Segoe UI"`;
      context.textAlign = element.align;
      context.textBaseline = "middle";
      context.fillText(element.text, element.x, element.y);
    } else if (signatureSvg) {
      const image = await rasterizeSignatureSvg(signatureSvg);
      context.drawImage(image, element.x, element.y, element.width, element.height);
    }
  }
  context.restore();
}
