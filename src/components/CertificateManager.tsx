import { Button, Input, Select } from "@fluentui/react-components";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import {
  bindCertificateSignature,
  certificateBindingState,
  createCertificate,
  deleteCertificateFromWindows,
  discoverWindowsCertificates,
  exportCertificateFile,
  exportCertificatePkcs12,
  importPkcs12,
  inspectPkcs12,
  listCertificates,
  removeCertificateProfile,
  setCertificateStatus,
} from "../certificates/certificateStorage";
import {
  certificateStatusLabel,
  certificateTrustLabel,
} from "../certificates/certificateUi";
import type {
  CertificateBindingState,
  CertificateProfile,
  SignatureMetadata,
} from "../types";
import { createId } from "../utils/ids";

interface Props {
  signatures: SignatureMetadata[];
}
type Filter = "all" | CertificateProfile["status"] | "self-signed" | "trusted";

const initialCreate = {
  subjectName: "",
  email: "",
  organization: "",
  displayName: "Personal Signing Certificate",
  validityYears: "3",
  bindSvgId: "",
};

function truncateOptionLabel(value: string, maxLength = 26) {
  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}...` : value;
}

function matchesFilter(
  certificate: CertificateProfile,
  filter: Filter,
): boolean {
  if (filter === "all") return true;
  if (filter === "self-signed" || filter === "trusted")
    return certificate.trust === filter;
  return certificate.status === filter;
}

export function CertificateManager({ signatures }: Props) {
  const [certificates, setCertificates] = useState<CertificateProfile[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [create, setCreate] = useState(initialCreate);
  const [importPath, setImportPath] = useState<string | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importName, setImportName] = useState("");
  const [importPreview, setImportPreview] = useState<CertificateProfile | null>(
    null,
  );
  const [bindingStates, setBindingStates] = useState<
    Record<string, CertificateBindingState>
  >({});
  const [editingBindingFor, setEditingBindingFor] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const profiles = await listCertificates();
    setCertificates(profiles);
    const states = await Promise.all(
      profiles.map(
        async (profile) =>
          [
            profile.id,
            await certificateBindingState(profile.id).catch(() => ({
              state: "missing" as const,
            })),
          ] as const,
      ),
    );
    setBindingStates(Object.fromEntries(states));
  };

  useEffect(() => {
    refresh().catch((reason: Error) => setError(reason.message));
  }, []);
  const visible = useMemo(
    () =>
      certificates.filter((certificate) => matchesFilter(certificate, filter)),
    [certificates, filter],
  );
  const call = async (work: () => Promise<void>) => {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      await work();
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Certificate action failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const createPersonalCertificate = () =>
    call(async () => {
      await createCertificate({
        id: createId("certificate"),
        displayName: create.displayName.trim(),
        subjectName: create.subjectName.trim(),
        email: create.email.trim() || undefined,
        organization: create.organization.trim() || undefined,
        validityYears: Number(create.validityYears),
        bindSvgId: create.bindSvgId || undefined,
      });
      setCreate(initialCreate);
      setMessage(
        "Digital certificate created in Windows secure key storage. It is self-signed unless you later use a CA-issued certificate.",
      );
    });
  const chooseImport = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PKCS#12 certificate", extensions: ["p12", "pfx"] }],
    });
    if (typeof selected !== "string") return;
    setImportPath(selected);
    setImportName(
      selected
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.(p12|pfx)$/i, "") || "Imported signing certificate",
    );
  };
  const importCertificate = () =>
    call(async () => {
      if (!importPath) throw new Error("Choose a P12/PFX file first.");
      await importPkcs12(
        createId("certificate"),
        importName.trim() || "Imported signing certificate",
        importPath,
        importPassword,
      );
      setImportPassword("");
      setImportPath(null);
      setImportPreview(null);
      setMessage(
        "Certificate imported into your Windows personal certificate store. Its password was not saved.",
      );
    });
  const discover = () =>
    call(async () => {
      await discoverWindowsCertificates();
      setMessage(
        "Windows certificates with available private keys were added to this wallet.",
      );
    });
  const bind = (certificateId: string, svgId: string) =>
    call(async () => {
      if (!svgId) throw new Error("Choose an SVG signature to bind.");
      await bindCertificateSignature(certificateId, svgId);
      setEditingBindingFor(null);
      setMessage("The SVG was bound using its SHA-256 fingerprint.");
    });
  const renew = (certificate: CertificateProfile) =>
    call(async () => {
      if (
        !window.confirm(
          `Create a new replacement certificate for ${certificate.displayName}? The old certificate will remain available for verifying existing PDFs.`,
        )
      )
        return;
      await createCertificate({
        id: createId("certificate"),
        displayName: `${certificate.displayName} (renewed)`,
        subjectName: certificate.subject.replace(
          /^.*?CN\s*=\s*([^,]+).*$/i,
          "$1",
        ),
        validityYears: 3,
        bindSvgId: certificate.boundSignature?.svgId,
        predecessorCertificateId: certificate.id,
      });
      setMessage(
        "A new certificate and key were created. The prior certificate remains in history.",
      );
    });
  const exportCer = (certificate: CertificateProfile) =>
    call(async () => {
      const target = await save({
        defaultPath: `${certificate.displayName}.cer`,
        filters: [{ name: "Certificate", extensions: ["cer"] }],
      });
      if (typeof target === "string")
        await exportCertificateFile(certificate.id, target);
    });
  const exportP12 = (certificate: CertificateProfile) =>
    call(async () => {
      if (
        !window.confirm(
          "Exporting a private key makes a portable copy. Store it securely and choose a strong password.",
        )
      )
        return;
      const password =
        window.prompt(
          "Choose a strong password for the P12/PFX export (it cannot be empty):",
        ) ?? "";
      if (!password)
        throw new Error(
          "Private-key export was cancelled because a password is required.",
        );
      const confirmation =
        window.prompt("Confirm the P12/PFX export password:") ?? "";
      if (confirmation !== password)
        throw new Error("The private-key export passwords do not match.");
      const target = await save({
        defaultPath: `${certificate.displayName}.p12`,
        filters: [{ name: "PKCS#12 certificate", extensions: ["p12"] }],
      });
      if (typeof target === "string")
        await exportCertificatePkcs12(certificate.id, target, password);
    });
  return (
    <section className="settings-card certificates-card">
      <div className="certificate-heading">
        <div>
          <h2>Digital Certificates</h2>
          <p className="empty-copy">
            Create or import certificates for signed PDFs.
          </p>
        </div>
        <Button size="small" disabled={busy} onClick={discover}>
          Use Windows Certificate
        </Button>
      </div>
      {error && <p className="error-banner">{error}</p>}
      {message && <p className="notice">{message}</p>}
      <div className="certificate-workflows">
        <details className="certificate-workflow">
          <summary>Create Digital Certificate</summary>
          <p className="empty-copy">
            Your private key is created in Windows secure key storage and is
            non-exportable by default.
          </p>
          <div className="certificate-form">
            <div className="field">
              <label htmlFor="certificate-name">Your name</label>
              <Input
                id="certificate-name"
                value={create.subjectName}
                onChange={(_, data) =>
                  setCreate((value) => ({ ...value, subjectName: data.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="certificate-email">Email (optional)</label>
              <Input
                id="certificate-email"
                type="email"
                value={create.email}
                onChange={(_, data) =>
                  setCreate((value) => ({ ...value, email: data.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="certificate-organization">
                Organization (optional)
              </label>
              <Input
                id="certificate-organization"
                value={create.organization}
                onChange={(_, data) =>
                  setCreate((value) => ({ ...value, organization: data.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="certificate-display-name">Certificate name</label>
              <Input
                id="certificate-display-name"
                value={create.displayName}
                onChange={(_, data) =>
                  setCreate((value) => ({ ...value, displayName: data.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="certificate-validity">Validity</label>
              <Select
                id="certificate-validity"
                value={create.validityYears}
                onChange={(_, data) =>
                  setCreate((value) => ({
                    ...value,
                    validityYears: data.value,
                  }))
                }
              >
                <option value="1">1 year</option>
                <option value="3">3 years</option>
                <option value="5">5 years</option>
              </Select>
            </div>
            <div className="field">
              <label htmlFor="certificate-svg">
                Visible handwritten signature
              </label>
              <Select
                id="certificate-svg"
                value={create.bindSvgId}
                onChange={(_, data) =>
                  setCreate((value) => ({ ...value, bindSvgId: data.value }))
                }
              >
                <option value="">No visible signature</option>
                {signatures.map((signature) => (
                  <option key={signature.id} value={signature.id} title={signature.name}>
                    {truncateOptionLabel(signature.name)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label>Protection</label>
              <Input
                value="Windows secure key storage (non-exportable)"
                readOnly
              />
            </div>
          </div>
          <Button
            appearance="primary"
            disabled={
              busy || !create.subjectName.trim() || !create.displayName.trim()
            }
            onClick={createPersonalCertificate}
          >
            Create Certificate
          </Button>
        </details>
        <details className="certificate-workflow">
          <summary>Import P12 / PFX</summary>
          <p className="empty-copy">
            The P12/PFX password is used only for this import and is never
            saved.
          </p>
          <div className="certificate-form">
            <div className="field">
              <label>Certificate file</label>
              <Button disabled={busy} onClick={chooseImport}>
                {importPath
                  ? importPath.split(/[\\/]/).pop()
                  : "Choose P12 / PFX"}
              </Button>
            </div>
            <div className="field">
              <label htmlFor="import-name">Certificate name</label>
              <Input
                id="import-name"
                value={importName}
                onChange={(_, data) => setImportName(data.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="import-password">P12/PFX password</label>
              <Input
                id="import-password"
                type="password"
                value={importPassword}
                onChange={(_, data) => setImportPassword(data.value)}
              />
            </div>
          </div>
          <div className="certificate-actions">
            <Button
              disabled={busy || !importPath}
              onClick={() =>
                call(async () => {
                  if (!importPath) return;
                  const preview = await inspectPkcs12(
                    importPath,
                    importPassword,
                  );
                  setImportPreview(preview);
                  setImportPassword("");
                })
              }
            >
              Inspect Certificate
            </Button>
            <Button
              appearance="primary"
              disabled={busy || !importPath}
              onClick={importCertificate}
            >
              Import Certificate
            </Button>
          </div>
          {importPreview && (
            <div className="certificate-import-preview">
              <strong>Certificate detected</strong>
              <span>Subject: {importPreview.subject}</span>
              <span>Issuer: {importPreview.issuer}</span>
              <span>
                Valid until:{" "}
                {new Date(importPreview.validUntil).toLocaleDateString()}
              </span>
              <span>
                {importPreview.privateKeyReference
                  ? "Private key available"
                  : "No private key available"}
              </span>
              <span>{certificateTrustLabel(importPreview)}</span>
            </div>
          )}
        </details>
      </div>
      <div className="certificate-list-header">
        <h3>Certificate wallet</h3>
        <Select
          aria-label="Certificate filter"
          value={filter}
          onChange={(_, data) => setFilter(data.value as Filter)}
        >
          <option value="all">All certificates</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="self-signed">Self-signed</option>
          <option value="trusted">Trusted</option>
          <option value="retired">Retired</option>
          <option value="compromised">Compromised</option>
          <option value="revoked">Revoked</option>
          <option value="missing-private-key">Missing private key</option>
        </Select>
      </div>
      {!visible.length && (
        <p className="empty-copy">No certificates match this filter.</p>
      )}
      <div className="certificate-list">
        {visible.map((certificate) => (
          <article className="certificate-item" key={certificate.id}>
            <div className="certificate-summary">
              <strong>{certificate.displayName}</strong>
              <span className={`certificate-status ${certificate.status}`}>
                {certificateStatusLabel(certificate)}
              </span>
              <span className="certificate-meta">
                {certificate.trust === "self-signed"
                  ? "Self-signed"
                  : certificate.trust}
              </span>
              <span className="certificate-meta">
                Expires {new Date(certificate.validUntil).toLocaleDateString()}
              </span>
            </div>
            <details className="certificate-manage">
              <summary>Manage certificate</summary>
              <p className="certificate-manage-meta">
                {certificate.privateKeyReference
                  ? "Private key available"
                  : "Private key unavailable"}
              </p>
              <dl className="certificate-details">
                <dt>Subject</dt>
                <dd>{certificate.subject}</dd>
                <dt>Issuer</dt>
                <dd>{certificate.issuer}</dd>
                <dt>Fingerprint (SHA-256)</dt>
                <dd className="fingerprint">
                  {certificate.certificateFingerprint}
                </dd>
                <dt>Serial number</dt>
                <dd>{certificate.serialNumber}</dd>
                <dt>Valid from</dt>
                <dd>{certificate.validFrom}</dd>
                <dt>Signature</dt>
                <dd>SHA-256 CMS/PKCS#7 detached PDF signature</dd>
                <dt>Key storage</dt>
                <dd>{certificate.privateKeyReference ?? "No private key"}</dd>
                {certificate.boundSignature && (
                  <>
                    <dt>SVG SHA-256</dt>
                    <dd className="fingerprint">
                      {certificate.boundSignature.svgSha256}
                    </dd>
                  </>
                )}
              </dl>
              <div className="certificate-actions">
                {certificate.boundSignature &&
                editingBindingFor !== certificate.id ? (
                  <div className="certificate-binding-control">
                    <span
                      className={`certificate-binding ${
                        bindingStates[certificate.id]?.state ?? "missing"
                      }`}
                    >
                      Bound to {" "}
                      {signatures.find(
                        (signature) =>
                          signature.id === certificate.boundSignature?.svgId,
                      )?.name ?? "missing SVG"}
                    </span>
                    <Button
                      appearance="subtle"
                      disabled={busy}
                      onClick={() => setEditingBindingFor(certificate.id)}
                      size="small"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Select
                    aria-label={`Bind SVG to ${certificate.displayName}`}
                    value={certificate.boundSignature?.svgId ?? ""}
                    onChange={(_, data) => bind(certificate.id, data.value)}
                  >
                    <option value="" disabled>
                      {certificate.boundSignature
                        ? "Select replacement SVG…"
                        : "Select SVG signature…"}
                    </option>
                    {signatures.map((signature) => (
                      <option key={signature.id} value={signature.id}>
                        {signature.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Button
                  size="small"
                  disabled={busy || certificate.source !== "generated"}
                  onClick={() => renew(certificate)}
                >
                  Renew
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => exportCer(certificate)}
                >
                  Export .cer
                </Button>
                <Button
                  size="small"
                  disabled={busy || !certificate.privateKeyReference}
                  onClick={() => exportP12(certificate)}
                >
                  Export .p12
                </Button>
                <Button
                  size="small"
                  disabled={
                    busy ||
                    ["retired", "compromised"].includes(certificate.status)
                  }
                  onClick={() =>
                    call(async () => {
                      await setCertificateStatus(certificate.id, "retired");
                    })
                  }
                >
                  Retire
                </Button>
                <Button
                  size="small"
                  disabled={
                    busy ||
                    ["retired", "compromised"].includes(certificate.status)
                  }
                  onClick={() =>
                    call(async () => {
                      if (
                        window.confirm(
                          "Mark this certificate as locally compromised? This does not revoke it outside EasySamnao.",
                        )
                      )
                        await setCertificateStatus(
                          certificate.id,
                          "compromised",
                        );
                    })
                  }
                >
                  Mark compromised
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    call(async () => {
                      if (
                        window.confirm(
                          "Remove this certificate from EasySamnao? Its Windows certificate and private key will remain untouched.",
                        )
                      )
                        await removeCertificateProfile(certificate.id);
                    })
                  }
                >
                  Remove from EasySamnao
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    call(async () => {
                      const confirmation =
                        window.prompt(
                          `This permanently deletes ${certificate.displayName} and its private key from Windows. Type DELETE CERTIFICATE to continue:`,
                        ) ?? "";
                      if (confirmation !== "DELETE CERTIFICATE")
                        throw new Error(
                          "Windows certificate deletion was cancelled.",
                        );
                      await deleteCertificateFromWindows(
                        certificate.id,
                        confirmation,
                      );
                    })
                  }
                >
                  Delete from Windows…
                </Button>
              </div>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
