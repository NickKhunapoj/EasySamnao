export function easySamnaoPdfFilename(source: string): string {
  return `${source.replace(/\.[^.]+$/, "")}-easysamnao.pdf`;
}
export function easySamnaoPngFilename(source: string, page: number): string {
  return `${source.replace(/\.[^.]+$/, "")}-easysamnao-page-${String(page + 1).padStart(3, "0")}.png`;
}
