import { svgObjectUrl } from "./sanitizeSvg";

export function recolorSignatureSvg(svg: string, color?: string): string {
  if (!color) return svg;
  return svg.replace(/\s(fill|stroke)=("|')[^"']*("|')/gi, "").replace(/<svg\b([^>]*)>/i, `<svg$1 fill="${color}" stroke="${color}">`);
}

function removeOpaqueBlackBackdrop(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  let darkBorderPixels = 0;
  let borderPixels = 0;
  const inspect = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (data[index + 3] > 220) {
      borderPixels += 1;
      if (Math.max(data[index], data[index + 1], data[index + 2]) < 38) darkBorderPixels += 1;
    }
  };
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  for (let x = 0; x < width; x += step) { inspect(x, 0); inspect(x, height - 1); }
  for (let y = 0; y < height; y += step) { inspect(0, y); inspect(width - 1, y); }
  // Only key black when it is clearly a solid background, never for ordinary black ink on transparency.
  if (!borderPixels || darkBorderPixels / borderPixels < 0.8) return;
  for (let index = 0; index < data.length; index += 4) {
    const brightness = Math.max(data[index], data[index + 1], data[index + 2]);
    if (brightness < 38) data[index + 3] = 0;
    else if (brightness < 76) data[index + 3] = Math.round(data[index + 3] * (brightness - 38) / 38);
  }
  context.putImageData(image, 0, 0);
}

export async function rasterizeSignatureSvg(svg: string, color?: string, targetWidth?: number): Promise<HTMLCanvasElement> {
  const source = svgObjectUrl(recolorSignatureSvg(svg, color));
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The selected signature could not be rendered.")); image.src = source; });
  } finally { URL.revokeObjectURL(source); }
  const width = targetWidth ?? Math.max(1, image.naturalWidth);
  const height = Math.max(1, Math.round(width * (image.naturalHeight / Math.max(1, image.naturalWidth))));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create a signature canvas.");
  context.drawImage(image, 0, 0, width, height);
  removeOpaqueBlackBackdrop(context, width, height);
  return canvas;
}
