export function certifiedPdfFilename(source: string): string {
  return `${source.replace(/\.[^.]+$/, "")}-certified.pdf`;
}
export function certifiedPngFilename(source: string, page: number): string {
  return `${source.replace(/\.[^.]+$/, "")}-certified-page-${String(page + 1).padStart(3, "0")}.png`;
}
