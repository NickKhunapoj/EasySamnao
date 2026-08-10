import type { WatermarkTransform } from "../types";

export interface PageSize { width: number; height: number; }
export interface PdfTransform { centerX: number; centerY: number; width: number; rotation: number; }

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Converts the top-left browser coordinate model to PDF's bottom-left coordinate model. */
export function normalizedToPdfTransform(transform: WatermarkTransform, page: PageSize): PdfTransform {
  return {
    centerX: transform.x * page.width,
    centerY: (1 - transform.y) * page.height,
    width: transform.width * page.width,
    rotation: -transform.rotation
  };
}

export function editorPointToNormalized(x: number, y: number, page: PageSize): Pick<WatermarkTransform, "x" | "y"> {
  return { x: clamp(x / page.width, 0, 1), y: clamp(y / page.height, 0, 1) };
}

export function rotatePdfVector(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) };
}
