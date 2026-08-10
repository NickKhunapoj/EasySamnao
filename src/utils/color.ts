export interface RgbColor { r: number; g: number; b: number; }

export function parseHexColor(value: string): RgbColor {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid RGB hex colour: ${value}`);
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

export function colorToPdf(value: string): { r: number; g: number; b: number } {
  const color = parseHexColor(value);
  return { r: color.r / 255, g: color.g / 255, b: color.b / 255 };
}
