import { describe, expect, it } from "vitest";
import { canSignWithCertificate } from "./certificateUi";
import type { CertificateProfile } from "../types";

const profile = (
  status: CertificateProfile["status"],
  privateKeyReference: string | null = "windows-store:abc",
): CertificateProfile => ({
  id: "certificate-test",
  displayName: "Test",
  source: "generated",
  certificateFingerprint: "ABC",
  subject: "CN=Test",
  issuer: "CN=Test",
  serialNumber: "01",
  validFrom: "2026-01-01T00:00:00Z",
  validUntil: "2027-01-01T00:00:00Z",
  trust: "self-signed",
  status,
  privateKeyReference,
  createdAt: "1",
  updatedAt: "1",
});

describe("certificate signing eligibility", () => {
  it("allows active and expiring certificates with an available key", () => {
    expect(canSignWithCertificate(profile("active"))).toBe(true);
    expect(canSignWithCertificate(profile("expiring"))).toBe(true);
  });
  it("rejects expired or keyless certificates", () => {
    expect(canSignWithCertificate(profile("expired"))).toBe(false);
    expect(canSignWithCertificate(profile("active", null))).toBe(false);
  });
});
