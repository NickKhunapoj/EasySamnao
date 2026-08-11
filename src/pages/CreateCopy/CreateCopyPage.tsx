import { Button, Checkbox, Input, Select } from "@fluentui/react-components";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import {
  DocumentPreview,
  type ZoomMode,
} from "../../components/DocumentPreview";
import { PageThumbnails } from "../../components/PageThumbnails";
import { PropertiesPanel } from "../../components/PropertiesPanel";
import {
  createImportedDocument,
  createImportedDocumentFromFile,
} from "../../documents/importDocument";
import {
  easySamnaoPdfFilename,
  easySamnaoPngFilename,
} from "../../export/fileNames";
import { exportEasySamnaoPdf } from "../../export/pdfExport";
import { renderEasySamnaoPng } from "../../export/pngExport";
import {
  listSignatures,
  readSignatureSvg,
} from "../../signatures/signatureStorage";
import { useDocumentStore } from "../../state/documentStore";
import { useSettingsStore } from "../../state/settingsStore";
import type { ExportOptions, SignatureMetadata } from "../../types";
import { text } from "../../i18n/localization";
import {
  certificateBindingState,
  listCertificates,
  signPreparedPdf,
  verifyPdfSignatures,
} from "../../certificates/certificateStorage";
import { canSignWithCertificate } from "../../certificates/certificateUi";
import type {
  CertificateBindingState,
  CertificateProfile,
  DigitalSigningOptions,
  PdfSignatureVerification,
} from "../../types";

const initialExport: ExportOptions = { pageMode: "all", pngDpi: 300 };

function pagesToExport(
  pageMode: ExportOptions["pageMode"],
  activePage: number,
  selectedPages: number[],
  pageCount: number,
): number[] {
  if (pageMode === "current") return [activePage];
  if (pageMode === "all")
    return Array.from({ length: pageCount }, (_, index) => index);
  return selectedPages
    .filter((page) => page >= 0 && page < pageCount)
    .sort((first, second) => first - second);
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (
    reason &&
    typeof reason === "object" &&
    "message" in reason &&
    typeof reason.message === "string"
  ) {
    return reason.message;
  }
  return fallback;
}

export function CreateCopyPage() {
  const settings = useSettingsStore((state) => state.settings);
  const t = text(settings.language);
  const document = useDocumentStore((state) => state.document);
  const activePage = useDocumentStore((state) => state.activePage);
  const exportPages = useDocumentStore((state) => state.exportPages);
  const watermarkedPages = useDocumentStore((state) => state.watermarkedPages);
  const watermarks = useDocumentStore((state) => state.watermarks);
  const setDocument = useDocumentStore((state) => state.setDocument);
  const clearDocument = useDocumentStore((state) => state.clearDocument);
  const setActivePage = useDocumentStore((state) => state.setActivePage);
  const toggleExportPage = useDocumentStore((state) => state.toggleExportPage);
  const toggleWatermarkedPage = useDocumentStore(
    (state) => state.toggleWatermarkedPage,
  );
  const updateWatermark = useDocumentStore((state) => state.updateWatermark);
  const updateTransform = useDocumentStore((state) => state.updateTransform);
  const resetTransform = useDocumentStore((state) => state.resetTransform);
  const applyActiveWatermarkToWatermarked = useDocumentStore(
    (state) => state.applyActiveWatermarkToWatermarked,
  );
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);
  const [signatures, setSignatures] = useState<SignatureMetadata[]>([]);
  const [signatureSvg, setSignatureSvg] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomMode>("fit-page");
  const [exportOptions, setExportOptions] =
    useState<ExportOptions>(initialExport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<CertificateProfile[]>([]);
  const [signPdf, setSignPdf] = useState(false);
  const [certificateId, setCertificateId] = useState("");
  const [signReason, setSignReason] = useState("Certified true copy");
  const [signLocation, setSignLocation] = useState("");
  const [binding, setBinding] = useState<CertificateBindingState | null>(null);
  const [verifiedSignatures, setVerifiedSignatures] = useState<
    PdfSignatureVerification[]
  >([]);
  const signatureCache = useRef(new Map<string, string>());
  const watermark = watermarks[activePage] ?? null;
  const hasVisibleSvg = watermarkedPages.some((page) =>
    Boolean(watermarks[page]?.signatureId),
  );

  const refreshSignatures = async () => setSignatures(await listSignatures());
  const refreshCertificates = async () => {
    const available = await listCertificates();
    setCertificates(available);
    setCertificateId(
      (current) => current || available.find(canSignWithCertificate)?.id || "",
    );
  };
  useEffect(() => {
    Promise.all([refreshSignatures(), refreshCertificates()]).catch(
      (reason: Error) => setError(reason.message),
    );
  }, []);
  useEffect(() => {
    if (!certificateId) {
      setBinding(null);
      return;
    }
    certificateBindingState(certificateId)
      .then(setBinding)
      .catch((reason: Error) => setError(reason.message));
  }, [certificateId]);
  useEffect(() => {
    if (!watermark?.signatureId) {
      setSignatureSvg(null);
      return;
    }
    readSignatureSvg(watermark.signatureId)
      .then((svg) => {
        signatureCache.current.set(watermark.signatureId!, svg);
        setSignatureSvg(svg);
      })
      .catch((reason: Error) => {
        setSignatureSvg(null);
        setError(`The selected signature is unavailable: ${reason.message}`);
      });
  }, [watermark?.signatureId]);
  useEffect(() => {
    if (!hasVisibleSvg) setSignPdf(false);
  }, [hasVisibleSvg]);
  useEffect(() => {
    if (!successPath) return;
    const timeout = window.setTimeout(() => setSuccessPath(null), 10_000);
    return () => window.clearTimeout(timeout);
  }, [successPath]);

  const importDocument = async () => {
    try {
      setError(null);
      setSuccessPath(null);
      const path = await open({
        multiple: false,
        filters: [{ name: "Documents", extensions: ["pdf", "png"] }],
      });
      if (typeof path !== "string") return;
      const loaded = await createImportedDocument(path);
      setDocument(loaded, settings);
      setVerifiedSignatures(
        loaded.kind === "pdf"
          ? await verifyPdfSignatures(loaded.bytes).catch(() => [])
          : [],
      );
      const defaultSignature = (await listSignatures()).find(
        (signature) => signature.isDefault,
      );
      if (defaultSignature)
        updateWatermark({ signatureId: defaultSignature.id });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to import the document.",
      );
    }
  };
  const discardWork = () => {
    if (!document || !window.confirm(t.discardConfirm)) return;
    clearDocument();
    signatureCache.current.clear();
    setSignatureSvg(null);
    setZoom("fit-page");
    setExportOptions(initialExport);
    setError(null);
    setSuccessPath(null);
    setVerifiedSignatures([]);
  };
  const dropFile = async (file: File) => {
    try {
      setError(null);
      const loaded = await createImportedDocumentFromFile(file);
      setDocument(loaded, settings);
      setVerifiedSignatures(
        loaded.kind === "pdf"
          ? await verifyPdfSignatures(loaded.bytes).catch(() => [])
          : [],
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to import the dropped file.",
      );
    }
  };
  const signatureFor = async (id: string | null): Promise<string | null> => {
    if (!id) return null;
    const cached = signatureCache.current.get(id);
    if (cached) return cached;
    const svg = await readSignatureSvg(id);
    signatureCache.current.set(id, svg);
    return svg;
  };
  const write = async (path: string, bytes: Uint8Array) =>
    invoke("write_export_file", { path, bytes: Array.from(bytes) });
  const revealExportedFile = async () => {
    if (!successPath) return;
    try {
      setError(null);
      await revealItemInDir(successPath);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to open the exported file location.",
      );
    }
  };
  const exportPdf = async () => {
    if (!document) return;
    try {
      setBusy(true);
      setError(null);
      setSuccessPath(null);
      const pages = pagesToExport(
        exportOptions.pageMode,
        activePage,
        exportPages,
        document.pages.length,
      );
      if (!pages.length) throw new Error("Select at least one page to export.");
      const target = await save({
        defaultPath: easySamnaoPdfFilename(document.filename),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof target !== "string") return;
      const includedWatermarks = Object.fromEntries(
        pages
          .filter((page) => watermarkedPages.includes(page))
          .map((page) => [page, watermarks[page]]),
      );
      let digitalSigning: DigitalSigningOptions | undefined;
      if (signPdf) {
        const certificate = certificates.find(
          (item) => item.id === certificateId,
        );
        if (!certificate || !canSignWithCertificate(certificate))
          throw new Error(
            "Choose an active certificate with an available private key, or turn off digital signing.",
          );
        if (certificate.boundSignature && binding?.state === "changed")
          throw new Error(
            "The SVG currently associated with this certificate has changed. Review it and explicitly re-bind it before signing.",
          );
        if (certificate.boundSignature && binding?.state === "missing")
          throw new Error(
            "The SVG bound to this certificate is unavailable. Re-bind a signature or sign without a visible signature.",
          );
        const visibleSvgIds = [
          ...new Set(
            Object.values(includedWatermarks)
              .map((item) => item?.signatureId)
              .filter((item): item is string => Boolean(item)),
          ),
        ];
        if (
          visibleSvgIds.length &&
          certificate.boundSignature &&
          (binding?.state !== "valid" ||
            visibleSvgIds.some(
              (id) => id !== certificate.boundSignature?.svgId,
            ))
        ) {
          throw new Error(
            "This visible SVG is not bound to the selected certificate. Bind it in Settings, select the bound SVG, or remove the visible signature before signing.",
          );
        }
        const signingPage = pages.includes(activePage) ? activePage : pages[0];
        digitalSigning = {
          certificateId: certificate.id,
          signerName: certificate.subject,
          reason: signReason.trim() || "Document signing",
          location: signLocation.trim(),
          pageIndex: signingPage,
        };
      }
      const prepared = await exportEasySamnaoPdf(
        document,
        pages,
        includedWatermarks,
        signatureFor,
        settings,
        digitalSigning,
      );
      await write(
        target,
        digitalSigning
          ? await signPreparedPdf(digitalSigning.certificateId, prepared)
          : prepared,
      );
      setSuccessPath(target);
    } catch (reason) {
      setError(errorMessage(reason, "PDF export failed."));
    } finally {
      setBusy(false);
    }
  };
  const exportPng = async () => {
    if (!document) return;
    const pages = pagesToExport(
      exportOptions.pageMode,
      activePage,
      exportPages,
      document.pages.length,
    );
    try {
      setBusy(true);
      setError(null);
      setSuccessPath(null);
      if (!pages.length) throw new Error("Select at least one page to export.");
      if (pages.length > 1) {
        const folder = await open({
          directory: true,
          multiple: false,
          title: "Choose an output folder",
        });
        if (typeof folder !== "string") return;
        for (const index of pages) {
          const pageWatermark = watermarkedPages.includes(index)
            ? watermarks[index]
            : null;
          const output = await renderEasySamnaoPng(
            document,
            index,
            pageWatermark,
            await signatureFor(pageWatermark?.signatureId ?? null),
            exportOptions.pngDpi,
          );
          await write(
            `${folder}\\${easySamnaoPngFilename(document.filename, index)}`,
            output,
          );
        }
        setSuccessPath(folder);
      } else {
        const index = pages[0];
        const target = await save({
          defaultPath: easySamnaoPngFilename(document.filename, index),
          filters: [{ name: "PNG", extensions: ["png"] }],
        });
        if (typeof target !== "string") return;
        const pageWatermark = watermarkedPages.includes(index)
          ? watermarks[index]
          : null;
        const output = await renderEasySamnaoPng(
          document,
          index,
          pageWatermark,
          await signatureFor(pageWatermark?.signatureId ?? null),
          exportOptions.pngDpi,
        );
        await write(target, output);
        setSuccessPath(target);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PNG export failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="workspace page">
      <div className="workspace-top">
        <div className="workspace-header">
          <div>
            <h1>{t.createCopy}</h1>
            <div className="document-meta">
              {document
                ? `${document.filename} · ${document.pages.length} ${t.pages.toLowerCase()} · ${Math.round(document.pages[activePage]?.width ?? 0)} × ${Math.round(document.pages[activePage]?.height ?? 0)}`
                : t.localUtility}
            </div>
          </div>
          <div className="workspace-actions">
            <Button onClick={importDocument}>{t.importDocument}</Button>
            <Button
              appearance="secondary"
              className="discard-button"
              disabled={!document || busy}
              onClick={discardWork}
            >
              {t.discard}
            </Button>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {successPath && (
          <div className="notice">
            {t.exportCompleted}{" "}
            <Button size="small" onClick={revealExportedFile}>
              {t.openFolder}
            </Button>
          </div>
        )}
      </div>
      {verifiedSignatures.length > 0 && (
        <section
          className="signature-verification"
          aria-label="Digital signatures"
        >
          <h2>Digital Signatures</h2>
          {verifiedSignatures.map((result, index) => (
            <div
              key={`${result.certificateFingerprint ?? "unknown"}-${index}`}
              className={result.integrityValid ? "notice" : "error-banner"}
            >
              <strong>
                Signature {index + 1}:{" "}
                {result.integrityValid
                  ? "Document integrity valid"
                  : "Signature invalid"}
              </strong>
              <span>{result.signer && ` · ${result.signer}`}</span>
              <div>{result.message}</div>
            </div>
          ))}
        </section>
      )}
      <div className="workspace-grid">
        <PageThumbnails
          document={document}
          activePage={activePage}
          exportPages={exportPages}
          watermarkedPages={watermarkedPages}
          onActivate={setActivePage}
          onToggleExport={toggleExportPage}
          onToggleWatermark={toggleWatermarkedPage}
          language={settings.language}
        />
        <DocumentPreview
          document={document}
          activePage={activePage}
          watermark={watermark}
          signatureSvg={signatureSvg}
          zoom={zoom}
          onImport={importDocument}
          onDropFile={dropFile}
          onTransform={updateTransform}
          onUndo={undo}
          onRedo={redo}
          onZoomChange={setZoom}
        />
        <PropertiesPanel
          watermark={watermark}
          signatures={signatures}
          onChange={updateWatermark}
          onTransform={updateTransform}
          onReset={() => resetTransform(settings)}
          onApplyToWatermarked={applyActiveWatermarkToWatermarked}
        />
      </div>
      {hasVisibleSvg && (
        <section className="digital-signing-panel">
          <div className="digital-signing-header">
            <Checkbox
              checked={signPdf}
              disabled={!document || busy}
              onChange={(_, data) => setSignPdf(data.checked === true)}
              label="Digitally sign this SVG PDF (optional)"
            />
            {signPdf && (
              <span
                className={`binding-indicator ${binding?.state ?? "unbound"}`}
              >
                {binding?.state === "valid"
                  ? "SVG bound"
                  : binding?.state === "changed"
                    ? "SVG changed"
                    : binding?.state === "missing"
                      ? "SVG missing"
                      : "Choose any certificate"}
              </span>
            )}
          </div>
          {signPdf && (
            <div className="digital-signing-fields">
            <div className="field">
              <label htmlFor="sign-certificate">Certificate</label>
              <Select
                id="sign-certificate"
                value={certificateId}
                onChange={(_, data) => setCertificateId(data.value)}
              >
                {!certificates.length && (
                  <option value="">
                    No certificates — create one in Settings
                  </option>
                )}
                {certificates.map((certificate) => (
                  <option
                    key={certificate.id}
                    value={certificate.id}
                    disabled={!canSignWithCertificate(certificate)}
                  >
                    {certificate.displayName} · {certificate.status}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="sign-reason">Reason</label>
              <Input
                id="sign-reason"
                value={signReason}
                onChange={(_, data) => setSignReason(data.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sign-location">Location</label>
              <Input
                id="sign-location"
                value={signLocation}
                onChange={(_, data) => setSignLocation(data.value)}
              />
            </div>
            </div>
          )}
        </section>
      )}
      <footer className="toolbar">
        <div className="toolbar-left">
          <div className="zoom-controls">
            <span>{t.previewZoom}</span>
            <Select
              value={String(zoom)}
              onChange={(_, data) =>
                setZoom(
                  data.value === "fit-page" || data.value === "fit-width"
                    ? data.value
                    : Number(data.value),
                )
              }
            >
              <option value="fit-page">{t.fitPage}</option>
              <option value="fit-width">{t.fitWidth}</option>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                <option key={value} value={value}>
                  {Math.round(value * 100)}%
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="toolbar-right">
          <Select
            aria-label={t.exportPages}
            value={exportOptions.pageMode}
            onChange={(_, data) =>
              setExportOptions((current) => ({
                ...current,
                pageMode: data.value as ExportOptions["pageMode"],
              }))
            }
          >
            <option value="current">{t.currentPage}</option>
            <option value="selected">{t.selectedPages}</option>
            <option value="all">{t.allPages}</option>
          </Select>
          <Select
            aria-label={t.pngResolution}
            value={String(exportOptions.pngDpi)}
            onChange={(_, data) =>
              setExportOptions((current) => ({
                ...current,
                pngDpi: Number(data.value) as ExportOptions["pngDpi"],
              }))
            }
          >
            <option value="150">150 DPI</option>
            <option value="300">300 DPI</option>
            <option value="600">600 DPI</option>
          </Select>
          <Button disabled={!document || busy} onClick={exportPng}>
            {t.exportPng}
          </Button>
          <Button
            appearance="primary"
            disabled={!document || busy}
            onClick={exportPdf}
          >
            {t.exportPdf}
          </Button>
        </div>
      </footer>
    </main>
  );
}
