import type { CertificateProfile } from "../types";

export function certificateStatusLabel(
  certificate: CertificateProfile,
): string {
  const status = certificate.status.replaceAll("-", " ");
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function certificateTrustLabel(certificate: CertificateProfile): string {
  if (certificate.trust === "self-signed")
    return "Self-signed — identity is not independently verified";
  if (certificate.trust === "trusted") return "Trusted by Windows";
  if (certificate.trust === "untrusted") return "Untrusted";
  return "Trust status unknown";
}

export function canSignWithCertificate(
  certificate: CertificateProfile | undefined,
): boolean {
  return Boolean(
    certificate &&
    ["active", "expiring"].includes(certificate.status) &&
    certificate.privateKeyReference,
  );
}
