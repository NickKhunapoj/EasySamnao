import { Button, Spinner } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ImportedDocument, WatermarkInstance } from "../types";
import { useSettingsStore } from "../state/settingsStore";
import { text } from "../i18n/localization";
import { disposePdf, loadPdf } from "../documents/importDocument";
import { PdfCanvas } from "./PdfCanvas";
import { PngCanvas } from "./PngCanvas";
import { WatermarkOverlay } from "../editor/WatermarkOverlay";

export type ZoomMode = "fit-page" | "fit-width" | number;

interface Props {
  document: ImportedDocument | null;
  activePage: number;
  watermark: WatermarkInstance | null;
  signatureSvg: string | null;
  zoom: ZoomMode;
  onImport: () => void;
  onDropFile: (file: File) => void;
  onTransform: (patch: Partial<WatermarkInstance["transform"]>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: (zoom: number) => void;
}

function usePdf(bytes: Uint8Array | undefined): { pdf: PDFDocumentProxy | null; error: string | null } {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!bytes) { setPdf(null); return; }
    let alive = true;
    let loaded: PDFDocumentProxy | null = null;
    setPdf(null); setError(null);
    loadPdf(bytes).then(({ pdf: result }) => { loaded = result; if (alive) setPdf(result); else void disposePdf(result); }).catch((reason: Error) => alive && setError(reason.message));
    return () => { alive = false; if (loaded) void disposePdf(loaded); };
  }, [bytes]);
  return { pdf, error };
}

export function DocumentPreview(props: Props) {
  const t = text(useSettingsStore((state) => state.settings.language));
  const container = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 700, height: 700 });
  const { pdf, error } = usePdf(props.document?.kind === "pdf" ? props.document.bytes : undefined);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const page = props.document?.pages[props.activePage];
  const fitPageScale = !page ? 1 : Math.max(0.1, Math.min((containerSize.width - 24) / page.width, (containerSize.height - 24) / page.height));
  const requestedScale = !page ? 1 : typeof props.zoom === "number" ? props.zoom : props.zoom === "fit-width"
    ? Math.max(0.1, (containerSize.width - 24) / page.width)
    : fitPageScale;
  // Keep the workspace fixed: zoom may reduce preview size, but never creates a scrolling document pane.
  const scale = Math.min(requestedScale, fitPageScale);
  const viewWidth = page ? Math.ceil(page.width * scale) : 0;
  const viewHeight = page ? Math.ceil(page.height * scale) : 0;
  const drop = (event: React.DragEvent) => { event.preventDefault(); const file = event.dataTransfer.files.item(0); if (file) props.onDropFile(file); };

  return <div className="preview-region" ref={container} onDragOver={(event) => event.preventDefault()} onDrop={drop} onWheel={(event) => {
    if (event.ctrlKey) { event.preventDefault(); const current = typeof props.zoom === "number" ? props.zoom : 1; props.onZoomChange(Math.max(0.5, Math.min(2, current + (event.deltaY < 0 ? 0.1 : -0.1)))); }
  }}>
    {!props.document && <div className="drop-target">
      <div aria-hidden="true" style={{ fontSize: 30 }}>⇧</div>
      <h2>{t.importPdfOrPng}</h2>
      <p>{t.dropDocument}</p>
      <Button appearance="primary" onClick={props.onImport}>{t.chooseDocument}</Button>
    </div>}
    {error && <div className="error-banner">{error}</div>}
    {props.document && !page && <Spinner label="Preparing preview…" />}
    {props.document && page && (props.document.kind !== "pdf" || pdf) && <div className="preview-canvas-wrap" style={{ width: viewWidth, height: viewHeight }}>
      {props.document.kind === "pdf" && pdf && <PdfCanvas pdf={pdf} page={props.activePage} scale={scale} />}
      {props.document.kind === "png" && <PngCanvas bytes={props.document.bytes} width={page.width} height={page.height} scale={scale} />}
      {props.watermark && <div style={{ position: "absolute", inset: 0, lineHeight: "normal" }}>
        <WatermarkOverlay width={viewWidth} height={viewHeight} watermark={props.watermark} signatureSvg={props.signatureSvg} onTransform={props.onTransform} onUndo={props.onUndo} onRedo={props.onRedo} />
      </div>}
    </div>}
    {props.document?.kind === "pdf" && !pdf && !error && <Spinner label="Rendering PDF…" />}
  </div>;
}
