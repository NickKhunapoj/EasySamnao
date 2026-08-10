import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPdfPage } from "../documents/pdfPreview";

export function PdfCanvas({ pdf, page, scale, className }: { pdf: PDFDocumentProxy; page: number; scale: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    renderPdfPage(pdf, page, canvas, scale).catch(() => { if (!cancelled) canvas.replaceChildren(); });
    return () => { cancelled = true; };
  }, [pdf, page, scale]);
  return <canvas ref={ref} className={className} aria-label={`Document page ${page + 1}`} />;
}
