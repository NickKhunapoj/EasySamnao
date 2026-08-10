import { Checkbox } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { AppLanguage, ImportedDocument } from "../types";
import { text } from "../i18n/localization";
import { disposePdf, loadPdf } from "../documents/importDocument";
import { PdfCanvas } from "./PdfCanvas";
import { PngCanvas } from "./PngCanvas";

function LazyPdfThumbnail({ pdf, page }: { pdf: PDFDocumentProxy; page: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(page < 3);
  useEffect(() => {
    const target = ref.current;
    if (!target || visible) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: "180px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible]);
  return <div ref={ref}>{visible ? <PdfCanvas pdf={pdf} page={page} scale={0.17} /> : <div style={{ height: 115 }} />}</div>;
}

export function PageThumbnails({ document, activePage, selectedPages, onActivate, onToggle, language }: { document: ImportedDocument | null; activePage: number; selectedPages: number[]; onActivate: (page: number) => void; onToggle: (page: number) => void; language: AppLanguage }) {
  const t = text(language);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  useEffect(() => {
    if (!document || document.kind !== "pdf") { setPdf(null); return; }
    let alive = true;
    let result: PDFDocumentProxy | null = null;
    loadPdf(document.bytes).then((loaded) => { result = loaded.pdf; if (alive) setPdf(result); else void disposePdf(result); }).catch(() => undefined);
    return () => { alive = false; if (result) void disposePdf(result); };
  }, [document]);
  if (!document) return <aside className="pages-panel"><h2>{t.pages}</h2><p className="empty-copy">{t.importDocumentToView}</p></aside>;
  return <aside className="pages-panel"><h2>{t.pages} ({document.pages.length})</h2>{document.pages.map((page) => <div key={page.index} className={`page-thumb ${page.index === activePage ? "selected" : ""}`}>
    <button style={{ border: 0, background: "transparent", padding: 0, width: "100%", cursor: "pointer" }} onClick={() => onActivate(page.index)} aria-label={`Open page ${page.index + 1}`}>
      {document.kind === "pdf" && pdf ? <LazyPdfThumbnail pdf={pdf} page={page.index} /> : document.kind === "png" ? <PngCanvas bytes={document.bytes} width={page.width} height={page.height} scale={0.17} /> : <div style={{ height: 115 }} />}
    </button>
    <div className="page-label"><Checkbox checked={selectedPages.includes(page.index)} onChange={() => onToggle(page.index)} label={`${t.include} P${page.index + 1}`} /></div>
  </div>)}</aside>;
}
